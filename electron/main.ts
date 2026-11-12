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
import { runParallelGeneration, runMultiAgentGeneration, reviseArticleWithAI } from "./services/generation";

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

let updateCheckInFlight: Promise<any> | null = null;

async function checkForUpdatesWithRetry(): Promise<any> {
  if (!app.isPackaged) return { updateInfo: null };
  if (updateCheckInFlight) return updateCheckInFlight;

  updateCheckInFlight = (async () => {
    const delays = [0, 2500, 6000];
    let lastError: any;

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }

      try {
        return await autoUpdater.checkForUpdates();
      } catch (error: any) {
        lastError = error;
        const message = String(error?.message || error || "");
        const transient = /HTTP 5\d\d|status code 5\d\d|504|502|503|timed? ?out|ECONNRESET|ECONNREFUSED|ENOTFOUND|network/i.test(message);
        if (!transient || attempt === delays.length - 1) break;
        console.warn(`[Auto Update] Temporary GitHub/network error; retrying (${attempt + 1}/${delays.length - 1}): ${message}`);
      }
    }

    const message = String(lastError?.message || "Update check failed.");
    const isGatewayError = /504|502|503|HTTP 5\d\d|status code 5\d\d/i.test(message);
    sendUpdateStatus({
      status: "error",
      message: isGatewayError
        ? "GitHub is temporarily unavailable. Your app is safe to use. Please try Check for Updates again in a few minutes."
        : message,
    });
    throw lastError;
  })().finally(() => {
    updateCheckInFlight = null;
  });

  return updateCheckInFlight;
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
  autoUpdater.on("error", (error) => {
    const message = String(error?.message || "Update check failed.");
    if (!/504|502|503|HTTP 5\d\d|status code 5\d\d/i.test(message)) {
      sendUpdateStatus({ status: "error", message });
    }
  });
  setTimeout(() => void checkForUpdatesWithRetry().catch(() => undefined), 8000);
  setInterval(() => void checkForUpdatesWithRetry().catch(() => undefined), 6 * 60 * 60 * 1000);
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
      model: id === "gemini" && ["gemini-3.8-flash", "gemini-3.6-flash"].includes(saved?.model) ? defaults[id].model : (saved?.model || defaults[id].model),
      apiKey: saved?.apiKey || defaults[id].apiKey,
      enabled: true,
      configured: Boolean((saved?.apiKey || defaults[id].apiKey || "").trim()),
    };
  });
  const custom = savedRows
    .filter((row: any) => !builtinIds.includes(row.provider) && !["image-openai", "image-imagen"].includes(row.provider))
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
  if (!provider.apiKey?.trim()) {
    throw new Error(`${provider.name} API key is missing. Save a valid API key in AI Providers before testing.`);
  }

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
      const apiMessage =
        data?.error?.message ||
        data?.message ||
        data?.error ||
        "The provider rejected the connection request.";
      throw new Error(
        `${provider.name} returned HTTP ${response.status} for model "${provider.model}": ${String(apiMessage)}`
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
    icon: path.join(__dirname, "../assets/madcraves.ico"),

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
  try {
    await checkForUpdatesWithRetry();
  } catch {
    // The helper has already set a user-friendly update status.
  }
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
    const articleId = Number(schedule.article_id);
    const siteId = Number(schedule.site_id);
    const article = articleId > 0 ? db.getArticle(articleId) : null;
    const site = siteId > 0 ? db.getSite(siteId) : null;
    if (!article) throw new Error("Scheduled article no longer exists.");
    if (!site) throw new Error("Scheduled WordPress website no longer exists.");
    await publishDraft(site, article);
    db.markPublished(articleId);
    win?.webContents.send("job:scheduled", scheduleId);
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
    ? db.getEnabledProviders()
        .filter((row: any) => row.provider === provider.provider)
        .sort((a: any, b: any) => Number(b.id) - Number(a.id))[0]
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

ipcMain.handle("articles:delete", (_event, articleId: number) => {
  requireValidLicense();
  const id = Number(articleId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("A valid article ID is required.");
  const article = db.getArticle(id);
  if (!article) throw new Error("Article not found.");
  const result = db.deleteArticle(id);
  if (article.featured_image_path && fs.existsSync(article.featured_image_path)) {
    try { fs.unlinkSync(article.featured_image_path); }
    catch (error) { console.warn("Could not remove the article's featured image:", error); }
  }
  return { ok: true, deleted: result.changes > 0 };
});

ipcMain.handle("articles:ai-edit", async (_event, input) => {
  requireValidLicense();
  const articleId = Number(input?.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) throw new Error("A valid article ID is required.");
  const instructions = typeof input?.instructions === "string" ? input.instructions.trim() : "";
  if (!instructions) throw new Error("Enter custom instructions for the article revision.");
  if (instructions.length > 10000) throw new Error("Custom instructions must be 10,000 characters or fewer.");
  const article = db.getArticle(articleId);
  if (!article) throw new Error("Article not found.");
  const providerId = String(input?.providerId || "");
  const provider = getBuiltinProviders().find((item) => item.id === providerId && item.enabled !== false && Boolean(item.apiKey?.trim()));
  if (!provider) throw new Error("Select an enabled AI provider with a saved API key.");
  const revised = await reviseArticleWithAI(article, instructions, provider);
  db.updateArticle({
    id: articleId,
    title: revised.title,
    content: revised.content,
    excerpt: revised.excerpt,
    slug: revised.slug,
    metaTitle: revised.metaTitle,
    metaDescription: revised.metaDescription,
    focusKeyword: article.focus_keyword || article.focusKeyword || revised.keywords?.[0] || "",
    keywords: revised.keywords,
  });
  return { ok: true, article: db.getArticle(articleId) };
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

    const allProviders = getBuiltinProviders();
    const providers = input.providerId && input.providerId !== "all"
      ? allProviders.filter((provider: any) => provider.id === input.providerId && provider.enabled !== false && provider.apiKey?.trim())
      : allProviders.filter((provider: any) => provider.enabled !== false && provider.apiKey?.trim());

    if (providers.length === 0 || !providers[0].apiKey?.trim()) {
      throw new Error(
        input.providerId
          ? `Selected AI provider "${input.providerId}" is not configured. Save its API key in AI Providers first.`
          : "No configured AI providers found. Save an API key in AI Providers first."
      );
    }

    const jobId = db.createJob(input);

    try {
      const results = input?.providerId === "all"
        ? await runMultiAgentGeneration(input, providers)
        : input?.multiAgent
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

ipcMain.handle("images:get", (_event, articleId: number) => {
  requireValidLicense();
  const article = db.getArticle(Number(articleId));
  if (!article) return null;
  const content = String(article.content || "");
  const featured = content.match(/<!--\s*MADCRAVES_FEATURED_IMAGE:([\s\S]*?)\s*-->/i);
  if (featured?.[1]) {
    try { return JSON.parse(decodeURIComponent(featured[1])).url || null; } catch { return null; }
  }
  if (article.featured_image_path && fs.existsSync(article.featured_image_path)) {
    const extension = path.extname(article.featured_image_path).toLowerCase();
    const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${fs.readFileSync(article.featured_image_path).toString("base64")}`;
  }
  const firstImage = content.match(/<img\b[^>]*src=["'](https?:\/\/[^"']+)["']/i);
  return firstImage?.[1] || null;
});

// --------------------------------------------------
// ARTICLE IMAGE SEARCH (OPENVERSE + WIKIMEDIA COMMONS)
// --------------------------------------------------

function cleanImageSearchText(value: string): string {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 110);
}

ipcMain.handle("images:search", async (_event, input) => {
  requireValidLicense();
  const articleId = Number(input?.articleId);
  if (!Number.isInteger(articleId) || articleId <= 0) throw new Error("Select a saved article before searching for images.");
  const article = db.getArticle(articleId);
  if (!article) throw new Error("Article not found.");

  const html = String(article.content || "");
  const headings = [...html.matchAll(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi)]
    .map((match) => cleanImageSearchText(match[1]))
    .filter((value) => value.length > 8);
  const title = cleanImageSearchText(article.title);
  const keyword = cleanImageSearchText(article.focus_keyword || article.focusKeyword || "");
  const customQuery = cleanImageSearchText(String(input?.customQuery || "").slice(0, 180));
  const queries = [
    ...(customQuery ? [{ query: customQuery, section: "Custom search" }] : []),
    { query: title, section: "Featured / overall topic" },
    ...(keyword && keyword.toLowerCase() !== title.toLowerCase() ? [{ query: keyword, section: "Featured / overall topic" }] : []),
    ...headings.slice(0, 4).map((heading) => ({ query: heading, section: heading })),
  ].filter((item, index, all) => item.query.length > 2
    && all.findIndex((candidate) => candidate.query.toLowerCase() === item.query.toLowerCase()) === index)
    .slice(0, 6);
  if (!queries.length) throw new Error("Enter a custom image search topic or select an article with a title.");

  async function requestJson(url: string): Promise<any> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await net.fetch(url, {
          headers: {
            "User-Agent": "MadCravesAIContentStudio/1.0 (https://madcraves.com)",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(30000),
        });
        if (response.ok) return await response.json();
        const body: any = await response.clone().json().catch(() => ({}));
        const message = body?.detail || body?.error?.info || `Image provider returned HTTP ${response.status}.`;
        if (response.status < 500 && response.status !== 429) throw new Error(message);
        lastError = new Error(message);
      } catch (error) {
        lastError = error;
      }
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
    throw lastError instanceof Error ? lastError : new Error("Image provider network request failed.");
  }

  async function searchOpenverse(item: { query: string; section: string }) {
    const params = new URLSearchParams({
      q: item.query,
      page_size: "20",
      license: "cc0,by,by-sa,pdm",
      mature: "false",
    });
    const data = await requestJson("https://api.openverse.org/v1/images/?" + params.toString());
    return (Array.isArray(data?.results) ? data.results : []).map((image: any) => ({
      id: `openverse-${image.id || image.url}`,
      title: String(image.title || "Untitled image"),
      imageUrl: String(image.url || ""),
      thumbnailUrl: String(image.thumbnail || image.url || ""),
      sourceUrl: String(image.foreign_landing_url || image.detail_url || ""),
      width: Number(image.width || 0),
      height: Number(image.height || 0),
      artist: String(image.creator || "Unknown creator"),
      license: String(image.license || "License not specified").toUpperCase(),
      usageTerms: String(image.license_version || ""),
      attribution: String(image.attribution || image.creator || ""),
      description: String(image.title || item.query),
      section: item.section,
      searchQuery: item.query,
      provider: "Openverse",
    })).filter((image: any) => image.imageUrl.startsWith("https://")
      && image.thumbnailUrl.startsWith("https://") && image.sourceUrl.startsWith("https://")
      && ((image.width >= 300 && image.height >= 200) || (image.width >= 200 && image.height >= 300))
      && /^(CC0|BY|BY-SA|PDM)$/i.test(image.license));
  }

  async function searchCommons(item: { query: string; section: string }) {
    const params = new URLSearchParams({
      action: "query", format: "json", generator: "search", gsrnamespace: "6",
      gsrsearch: `${item.query} filetype:bitmap`, gsrlimit: "15", prop: "imageinfo",
      iiprop: "url|extmetadata", iiurlwidth: "1200",
    });
    const data = await requestJson("https://commons.wikimedia.org/w/api.php?" + params.toString());
    return Object.values(data?.query?.pages || {}).map((page: any) => {
      const info = page?.imageinfo?.[0];
      const meta = info?.extmetadata || {};
      const value = (key: string) => String(meta?.[key]?.value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      return {
        id: `commons-${page.pageid}`,
        title: String(page.title || "").replace(/^File:/, ""),
        imageUrl: info?.url || "",
        thumbnailUrl: info?.thumburl || info?.url || "",
        sourceUrl: info?.descriptionurl || "",
        width: Number(info?.width || 0),
        height: Number(info?.height || 0),
        artist: value("Artist") || value("Credit") || "Unknown creator",
        license: value("LicenseShortName") || "License not specified",
        usageTerms: value("UsageTerms"),
        attribution: value("Attribution") || value("Artist"),
        description: value("ImageDescription") || String(page.title || "").replace(/^File:/, ""),
        section: item.section,
        searchQuery: item.query,
        provider: "Wikimedia Commons",
      };
    }).filter((image: any) => image.imageUrl.startsWith("https://")
      && image.thumbnailUrl.startsWith("https://") && image.sourceUrl.startsWith("https://")
      && ((image.width >= 300 && image.height >= 200) || (image.width >= 200 && image.height >= 300))
      && /^(CC0|CC BY|CC BY-SA|Public domain)/i.test(image.license));
  }

  // Search both free image indexes for every topic, rather than using Commons only
  // when Openverse fails. This substantially broadens results for each search.
  const providerErrors: string[] = [];
  const batches = await Promise.all(queries.map(async (item) => {
    const [openverseResults, commonsResults] = await Promise.all([
      searchOpenverse(item).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`Openverse: ${message}`);
        console.warn(`[Image Search] Openverse failed ("${item.query}"): ${message}`);
        return [];
      }),
      searchCommons(item).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`Wikimedia Commons: ${message}`);
        console.warn(`[Image Search] Wikimedia Commons failed ("${item.query}"): ${message}`);
        return [];
      }),
    ]);
    return [...openverseResults, ...commonsResults];
  }));

  const unique = new Map<string, any>();
  for (const image of batches.flat()) {
    if (image.imageUrl && !unique.has(image.imageUrl)) unique.set(image.imageUrl, image);
  }
  const results = [...unique.values()].slice(0, 60);
  if (!results.length) {
    const providerDetail = [...new Set(providerErrors)].slice(0, 4).join(" | ");
    throw new Error(providerDetail
      ? `Image providers could not return results. ${providerDetail}. Check your internet connection or try again later.`
      : "The image libraries returned no matching images under the selected free-use licenses. Try a shorter or broader search phrase.");
  }
  return {
    ok: true,
    articleId,
    queries: queries.map((item) => item.query),
    results,
  };
});
