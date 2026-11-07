import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  net,
} from "electron";
import { autoUpdater } from "electron-updater";

import path from "node:path";
import fs from "node:fs";

import { Database } from "./services/database";
import { runParallelGeneration, runMultiAgentGeneration } from "./services/generation";

import {
  publishDraft,
  testWordPressConnection,
} from "./services/wordpress";

import { startScheduler } from "./services/scheduler";

import {
  getMachineId,
  getLicenseStatus,
  activateLicense,
} from "./services/license";

import {
  API_KEYS,
  AI_MODELS,
} from "./config/api-keys";

let win: BrowserWindow | null = null;
let db: Database;
let networkTimer: ReturnType<typeof setInterval> | null = null;
let updateStatus: { status: string; version?: string; message?: string; percent?: number; transferred?: number; total?: number; bytesPerSecond?: number } = { status: "idle", percent: 0 };

function sendUpdateStatus(status: typeof updateStatus) {
  updateStatus = status;
  win?.webContents.send("updates:status", updateStatus);
}

function configureAutoUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => sendUpdateStatus({ status: "checking" }));
  autoUpdater.on("update-available", (info) => sendUpdateStatus({ status: "downloading", version: info.version, message: "A new version is available. Downloading automatically..." }));
  autoUpdater.on("update-not-available", (info) => sendUpdateStatus({ status: "latest", version: info.version, message: "You are using the latest version." }));
  autoUpdater.on("download-progress", (progress) => sendUpdateStatus({ status: "downloading", version: updateStatus.version, percent: Math.max(0, Math.min(100, progress.percent)), transferred: progress.transferred, total: progress.total, bytesPerSecond: progress.bytesPerSecond, message: `Downloading version ${updateStatus.version || "update"}…` }));
  autoUpdater.on("update-downloaded", (info) => sendUpdateStatus({ status: "downloaded", version: info.version, percent: 100, message: `Version ${info.version} is downloaded and ready to install.` }));
  autoUpdater.on("error", (error) => sendUpdateStatus({ status: "error", message: error.message || "Update check failed." }));
  setTimeout(() => void autoUpdater.checkForUpdates().catch((error) => sendUpdateStatus({ status: "error", message: error.message })), 8000);
  setInterval(() => void autoUpdater.checkForUpdates().catch((error) => sendUpdateStatus({ status: "error", message: error.message })), 6 * 60 * 60 * 1000);
}

const licenseFile = () =>
  path.join(app.getPath("userData"), "license.json");

// --------------------------------------------------
// PORTABLE APPLICATION DATA
// --------------------------------------------------

const portableBase =
  process.env.PORTABLE_EXECUTABLE_DIR ||
  (process.env.PORTABLE_EXECUTABLE_FILE
    ? path.dirname(process.env.PORTABLE_EXECUTABLE_FILE)
    : undefined);

const isPortableBuild = app.isPackaged && Boolean(portableBase);

if (isPortableBuild && portableBase) {
  const dataPath = path.join(
    portableBase,
    "AI-Content-Studio-Data"
  );

  app.setPath("userData", dataPath);
  app.setPath("sessionData", path.join(dataPath, "session"));
}

// --------------------------------------------------
// LICENSE PROTECTION
// --------------------------------------------------

function requireValidLicense(): void {
  const status = getLicenseStatus(licenseFile());

  if (!status.activated) {
    throw new Error(
      status.message || "A valid activation license is required."
    );
  }
}

ipcMain.handle("license:machine-id", () => getMachineId());

ipcMain.handle("license:status", () => {
  return getLicenseStatus(licenseFile());
});

ipcMain.handle("license:activate", (_event, code: string) => {
  if (typeof code !== "string" || !code.trim()) {
    throw new Error("Please enter your activation code.");
  }

  activateLicense(licenseFile(), code.trim());

  return getLicenseStatus(licenseFile());
});

// --------------------------------------------------
// ENCRYPTION HELPERS
// --------------------------------------------------

function encryptApiKey(apiKey: string): {
  apiKey: string;
  encrypted: boolean;
} {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();

  const encryptedKey = encryptionAvailable
    ? safeStorage.encryptString(apiKey).toString("base64")
    : Buffer.from(apiKey).toString("base64");

  return {
    apiKey: encryptedKey,
    encrypted: encryptionAvailable,
  };
}

function decryptApiKey(provider: any): any {
  const storedKey = provider.api_key ?? provider.apiKey ?? "";

  if (!storedKey) {
    return { ...provider, apiKey: "" };
  }

  const apiKey =
    provider.encrypted && safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(storedKey, "base64"))
      : Buffer.from(storedKey, "base64").toString("utf8");

  return {
    ...provider,
    apiKey,
  };
}

// --------------------------------------------------
// BUILT-IN AI PROVIDERS
// --------------------------------------------------

function getBuiltinProviders() {
  const savedRows = db.getEnabledProviders();
  const builtinIds = ["gemini", "groq", "openrouter"];
  const builtins = builtinIds.map((id) => {
    const savedRow = savedRows
      .filter((row: any) => row.provider === id)
      .sort((a: any, b: any) => Number(b.id) - Number(a.id))[0];
    const saved = savedRow ? decryptApiKey(savedRow) : null;
    const defaults: Record<string, any> = {
      gemini: { name: "Google Gemini", model: AI_MODELS.gemini, apiKey: API_KEYS.gemini },
      groq: { name: "Groq", model: AI_MODELS.groq, apiKey: API_KEYS.groq },
      openrouter: { name: "OpenRouter", model: AI_MODELS.openrouter, apiKey: API_KEYS.openrouter },
    };
    return {
      id,
      name: defaults[id].name,
      provider: id,
      model: saved?.model || defaults[id].model,
      apiKey: saved?.apiKey || defaults[id].apiKey,
      enabled: true,
      configured: Boolean((saved?.apiKey || defaults[id].apiKey || "").trim()),
    };
  });
  const custom = savedRows
    .filter((row: any) => !builtinIds.includes(row.provider))
    .map((row: any) => ({
      ...decryptApiKey(row),
      id: `custom:${row.id}`,
      name: row.name,
      provider: row.provider,
      model: row.model,
      baseUrl: row.base_url || "",
      enabled: Boolean(row.enabled),
      configured: Boolean(row.api_key),
    }));
  return [...builtins, ...custom];
}

function getProviderById(providerId: string) {
  const provider = getBuiltinProviders().find(
    (item) => item.id === providerId
  );

  if (!provider) {
    throw new Error(
      `AI provider "${providerId}" is not configured.`
    );
  }

  return provider;
}

// --------------------------------------------------
// AI PROVIDER CONNECTION TEST
// --------------------------------------------------

async function testAIProvider(providerId: string) {
  const provider = getProviderById(providerId);

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    30000
  );

  try {
    let response: Response;

    if (provider.id === "gemini") {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(provider.model)}:generateContent` +
        `?key=${encodeURIComponent(provider.apiKey)}`;

      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Reply with only the word OK.",
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
          },
        }),
      });
    } else {
      const endpoint = provider.id === "groq"
        ? "https://api.groq.com/openai/v1/chat/completions"
        : provider.id === "openrouter"
          ? "https://openrouter.ai/api/v1/chat/completions"
          : provider.baseUrl?.replace(/\/+$/, "").endsWith("/chat/completions")
            ? provider.baseUrl.replace(/\/+$/, "")
            : `${provider.baseUrl?.replace(/\/+$/, "")}/chat/completions`;

      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          ...(provider.id === "openrouter"
            ? {
                "HTTP-Referer": "https://madcraves.com",
                "X-Title": "MadCraves AI Content Studio",
              }
            : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: provider.model,
          messages: [
            {
              role: "user",
              content: "Reply with only the word OK.",
            },
          ],
          max_tokens: 10,
        }),
      });
    }

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        data?.message ||
        `HTTP ${response.status}`
      );
    }

    return {
      ok: true,
      success: true,
      provider: provider.id,
      model: provider.model,
      message: `${provider.name} connection successful.`,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`${provider.name} connection timed out.`);
    }

    throw new Error(
      error?.message || `${provider.name} connection failed.`
    );
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle(
  "providers:test",
  async (_event, providerId: string) => {
    requireValidLicense();

    if (typeof providerId !== "string") {
      throw new Error("Invalid AI provider.");
    }

    return testAIProvider(providerId);
  }
);

// --------------------------------------------------
// BROWSER WINDOW
// --------------------------------------------------

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "MadCraves AI Content Studio",

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(
      path.join(__dirname, "../dist/index.html")
    );
  }

  win.on("closed", () => {
    win = null;
  });
}

// --------------------------------------------------
// AUTOMATIC SOFTWARE UPDATES
// --------------------------------------------------
ipcMain.handle("updates:status", () => updateStatus);
ipcMain.handle("updates:check", async () => {
  if (!app.isPackaged) return { status: "development", message: "Updates are available in the installed version." };
  await autoUpdater.checkForUpdates();
  return updateStatus;
});
ipcMain.handle("updates:install", () => {
  if (updateStatus.status !== "downloaded") throw new Error("The update is not ready yet.");
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});

// --------------------------------------------------
// NETWORK STATUS
// --------------------------------------------------

function getNetworkStatus() {
  return {
    online: net.isOnline(),
  };
}

ipcMain.handle("network:status", () => getNetworkStatus());

function startNetworkMonitoring() {
  if (networkTimer) {
    clearInterval(networkTimer);
  }

  let previousStatus = net.isOnline();

  networkTimer = setInterval(() => {
    const currentStatus = net.isOnline();

    if (currentStatus !== previousStatus) {
      previousStatus = currentStatus;

      win?.webContents.send(
        "network:status-changed",
        { online: currentStatus }
      );
    }
  }, 5000);
}

// --------------------------------------------------
// APPLICATION INITIALIZATION
// --------------------------------------------------

app.whenReady().then(() => {
  const dataDir = app.getPath("userData");

  fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(
    path.join(dataDir, "studio.sqlite")
  );

  startNetworkMonitoring();
  configureAutoUpdates();

  startScheduler(db, async (scheduleId: number) => {
    requireValidLicense();

    const schedule = db.getSchedule(scheduleId);

    if (!schedule) return;

    const providers = getBuiltinProviders();

    if (providers.length === 0) {
      throw new Error(
        "No built-in AI providers are configured. Check api-keys.ts."
      );
    }

    const jobId = db.createJob({
      topic: schedule.topic,
      siteId: schedule.site_id,
    });

    try {
      const results = await runParallelGeneration(
        {
          topic: schedule.topic,
          keyword: schedule.keyword || schedule.topic,
          wordCount: 2000,
        },
        providers
      );

      db.saveGenerationResults(jobId, results);

      win?.webContents.send("job:scheduled", scheduleId);
    } catch (error: any) {
      db.failJob(jobId, error?.message || String(error));
      throw error;
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// --------------------------------------------------
// APPLICATION SHUTDOWN
// --------------------------------------------------

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (networkTimer) {
    clearInterval(networkTimer);
    networkTimer = null;
  }

  if (db) {
    db.close();
  }
});

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

ipcMain.handle("dashboard:get", () => {
  requireValidLicense();
  return db.dashboard();
});

// --------------------------------------------------
// WORDPRESS WEBSITES
// --------------------------------------------------

ipcMain.handle("sites:list", () => {
  requireValidLicense();
  return db.listSites();
});

ipcMain.handle("sites:add", (_event, site) => {
  requireValidLicense();
  return db.addSite(site);
});

ipcMain.handle("sites:delete", (_event, id: number) => {
  requireValidLicense();
  return db.deleteSite(id);
});

ipcMain.handle(
  "sites:test",
  async (_event, id: number) => {
    requireValidLicense();

    const site = db.getSite(id);

    if (!site) {
      throw new Error("WordPress website not found.");
    }

    const result = await testWordPressConnection(site);

    if (!result.success) {
      throw new Error(
        result.message || "WordPress connection failed."
      );
    }

    return {
      ...result,
      ok: true,
      success: true,
    };
  }
);

// --------------------------------------------------
// AI PROVIDERS
// --------------------------------------------------

ipcMain.handle("providers:save", (_event, provider) => {
  requireValidLicense();

  const apiKey =
    provider.apiKey ?? provider.api_key ?? "";

  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("API key cannot be empty.");
  }

  const encryption = encryptApiKey(apiKey);

  const builtinIds = ["gemini", "groq", "openrouter"];
  const existingBuiltin = builtinIds.includes(provider.provider)
    ? db.getEnabledProviders().find((row: any) => row.provider === provider.provider)
    : null;

  db.saveProvider({
    ...provider,
    id: existingBuiltin?.id,
    apiKey: encryption.apiKey,
    encrypted: encryption.encrypted,
    base_url: provider.baseUrl || provider.base_url || null,
  });

  return { ok: true };
});

ipcMain.handle("providers:list", () => {
  requireValidLicense();

  return getBuiltinProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    provider: provider.provider,
    model: provider.model,
    baseUrl: provider.baseUrl || "",
    enabled: provider.enabled !== false,
    configured: Boolean(provider.apiKey?.trim()),
    builtIn: !String(provider.id).startsWith("custom:"),
  }));
});

// --------------------------------------------------
// ARTICLES
// --------------------------------------------------

ipcMain.handle("articles:list", () => {
  requireValidLicense();
  return db.listArticles();
});

ipcMain.handle(
  "articles:generate",
  async (_event, input) => {
    requireValidLicense();

    if (!input || !input.topic?.trim()) {
      throw new Error("Article topic is required.");
    }

    if (!input.keyword?.trim()) {
      throw new Error("Primary SEO keyword is required.");
    }

    const providers = getBuiltinProviders();

    if (providers.length === 0) {
      throw new Error(
        "No built-in AI providers found. Check electron/config/api-keys.ts."
      );
    }

    const jobId = db.createJob(input);

    try {
      const results = input?.multiAgent
        ? await runMultiAgentGeneration(input, providers)
        : await runParallelGeneration(input, providers);

      if (!results || results.length === 0) {
        throw new Error(
          "AI providers did not return any articles."
        );
      }

      db.saveGenerationResults(jobId, results);

      return {
        ok: true,
        jobId,
        results,
      };
    } catch (error: any) {
      db.failJob(jobId, error?.message || "Generation failed");
      throw error;
    }
  }
);

// --------------------------------------------------
// WORDPRESS DRAFT PUBLISHING
// --------------------------------------------------

ipcMain.handle(
  "articles:publish",
  async (_event, { articleId, siteId }) => {
    requireValidLicense();

    const article = db.getArticle(articleId);

    if (!article) {
      throw new Error("Article not found.");
    }

    const site = db.getSite(siteId);

    if (!site) {
      throw new Error("WordPress website not found.");
    }

    const result = await publishDraft(site, article);

    db.markPublished(articleId);

    return {
      ok: true,
      ...result,
    };
  }
);

// --------------------------------------------------
// ARTICLE EDITING
// --------------------------------------------------

ipcMain.handle("articles:save-edit", (_event, article) => {
  requireValidLicense();
  return db.updateArticle(article);
});

// --------------------------------------------------
// CONTENT SCHEDULING
// --------------------------------------------------

ipcMain.handle("schedule:add", (_event, item) => {
  requireValidLicense();
  return db.addSchedule(item);
});

ipcMain.handle("schedule:list", () => {
  requireValidLicense();
  return db.listSchedules();
});

ipcMain.handle("schedule:delete", (_event, id: number) => {
  requireValidLicense();
  return db.deleteSchedule(id);
});

// --------------------------------------------------
// IMAGE GENERATION
// --------------------------------------------------

ipcMain.handle("images:generate", async () => {
  requireValidLicense();

  return {
    ok: false,
    message: "Image generation adapter is not implemented yet.",
  };
});
