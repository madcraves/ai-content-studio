import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage
} from "electron";

import path from "node:path";
import fs from "node:fs";

import { Database } from "./services/database";
import { runParallelGeneration } from "./services/generation";
import { publishDraft } from "./services/wordpress";
import { startScheduler } from "./services/scheduler";

let win: BrowserWindow | null = null;
let db: Database;

let networkTimer: ReturnType<typeof setInterval> | null = null;
let lastOnlineStatus: boolean | null = null;

// --------------------------------------------------
// Portable application data
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
  app.setPath(
    "sessionData",
    path.join(dataPath, "session")
  );
}

// --------------------------------------------------
// API key encryption
// --------------------------------------------------

function encryptApiKey(apiKey: string): {
  apiKey: string;
  encrypted: boolean;
} {
  if (!apiKey) {
    throw new Error("API key cannot be empty.");
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Windows secure storage is unavailable. API key was not saved."
    );
  }

  return {
    apiKey: safeStorage.encryptString(apiKey).toString("base64"),
    encrypted: true
  };
}

function decryptApiKey(provider: any): any {
  const storedKey = provider.api_key ?? provider.apiKey ?? "";

  if (!storedKey) {
    throw new Error(
      `${provider.name || "AI provider"} has no saved API key.`
    );
  }

  let apiKey = "";

  if (provider.encrypted && safeStorage.isEncryptionAvailable()) {
    apiKey = safeStorage.decryptString(
      Buffer.from(storedKey, "base64")
    );
  } else {
    // Compatibility with older versions that stored Base64 keys.
    apiKey = Buffer.from(storedKey, "base64").toString("utf8");
  }

  return {
    ...provider,
    apiKey
  };
}

// --------------------------------------------------
// Internet connectivity
// --------------------------------------------------

async function checkInternet(): Promise<boolean> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 5000);

  try {
    const response = await fetch(
      "https://www.google.com/generate_204",
      {
        method: "GET",
        signal: controller.signal,
        cache: "no-store"
      }
    );

    return response.status === 204 || response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateNetworkStatus(): Promise<boolean> {
  const online = await checkInternet();

  if (online !== lastOnlineStatus) {
    lastOnlineStatus = online;

    if (win && !win.isDestroyed()) {
      win.webContents.send(
        "network:status-changed",
        online
      );
    }
  }

  return online;
}

// --------------------------------------------------
// AI provider connection testing
// --------------------------------------------------

async function testAIProvider(providerName: string) {
  const normalized = providerName.toLowerCase();

  const savedProviders = db.getEnabledProviders();

  const savedProvider = savedProviders.find(
    (item: any) =>
      String(item.provider || item.name).toLowerCase() === normalized
  );

  if (!savedProvider) {
    throw new Error(
      `${providerName} is not configured or enabled.`
    );
  }

  const provider = decryptApiKey(savedProvider);
  const apiKey = provider.apiKey;

  let endpoint = "";
  const headers: Record<string, string> = {};

  if (normalized === "gemini") {
    endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models?key=" +
      encodeURIComponent(apiKey);
  } else if (normalized === "groq") {
    endpoint = "https://api.groq.com/openai/v1/models";
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (normalized === "openrouter") {
    endpoint = "https://openrouter.ai/api/v1/models";
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    throw new Error(`Unsupported AI provider: ${providerName}`);
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `${providerName} connection failed (${response.status}): ${details.slice(0, 300)}`
    );
  }

  return {
    ok: true,
    provider: providerName,
    message: `${providerName} connected successfully.`
  };
}

// --------------------------------------------------
// WordPress website connection testing
// --------------------------------------------------

async function testWordPressSite(siteId: number) {
  const site = db.getSite(siteId);

  if (!site) {
    throw new Error("Website not found.");
  }

  if (!site.url) {
    throw new Error("Website URL is missing.");
  }

  const baseUrl = String(site.url).replace(/\/+$/, "");

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/wp-json/`, {
      method: "GET",
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw new Error(
      "Website could not be reached. Check its URL and internet connection."
    );
  }

  if (!response.ok) {
    throw new Error(
      `WordPress REST API returned HTTP ${response.status}.`
    );
  }

  return {
    ok: true,
    siteId,
    message: "WordPress REST API is reachable."
  };
}

// --------------------------------------------------
// Browser window
// --------------------------------------------------

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: "AI Content Studio",

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      path.join(__dirname, "../dist/index.html")
    );
  }

  win.on("closed", () => {
    win = null;
  });
}

// --------------------------------------------------
// Application initialization
// --------------------------------------------------

app.whenReady().then(async () => {
  const dataDir = app.getPath("userData");

  fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(
    path.join(dataDir, "studio.sqlite")
  );

  createWindow();

  // Initial internet check
  void updateNetworkStatus();

  // Check internet connection every 10 seconds
  networkTimer = setInterval(() => {
    void updateNetworkStatus();
  }, 10000);

  // Start automatic scheduler
  startScheduler(db, (jobId: number) => {
    win?.webContents.send("job:scheduled", jobId);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// --------------------------------------------------
// Application shutdown
// --------------------------------------------------

app.on("window-all-closed", () => {
  if (networkTimer) {
    clearInterval(networkTimer);
    networkTimer = null;
  }

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
// Dashboard
// --------------------------------------------------

ipcMain.handle("dashboard:get", () => {
  return db.dashboard();
});

// --------------------------------------------------
// Internet status
// --------------------------------------------------

ipcMain.handle("network:status", async () => {
  return {
    online: await updateNetworkStatus()
  };
});

// --------------------------------------------------
// Websites
// --------------------------------------------------

ipcMain.handle("sites:list", () => {
  return db.listSites();
});

ipcMain.handle("sites:add", (_event, site) => {
  if (!site?.name || !site?.url || !site?.token) {
    throw new Error(
      "Website name, URL and application password are required."
    );
  }

  const normalizedUrl = String(site.url)
    .trim()
    .replace(/\/+$/, "");

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    throw new Error("Website URL must start with http:// or https://.");
  }

  return db.addSite({
    ...site,
    url: normalizedUrl
  });
});

ipcMain.handle("sites:delete", (_event, id: number) => {
  return db.deleteSite(id);
});

ipcMain.handle("sites:test", async (_event, id: number) => {
  return testWordPressSite(id);
});

// --------------------------------------------------
// AI Providers
// --------------------------------------------------

ipcMain.handle("providers:save", (_event, provider) => {
  const name = String(provider?.name || "").trim();
  const providerId = String(
    provider?.provider || name
  ).toLowerCase();

  if (!["gemini", "groq", "openrouter"].includes(providerId)) {
    throw new Error("Unsupported AI provider.");
  }

  if (!provider?.model) {
    throw new Error("Please enter an AI model.");
  }

  const existing = db.getEnabledProviders().find(
    (item: any) =>
      String(item.provider || item.name).toLowerCase() === providerId
  );

  // Keep the previously saved key when the key field is left empty.
  const suppliedKey = String(
    provider.apiKey || provider.api_key || ""
  ).trim();

  let encryption: {
    apiKey: string;
    encrypted: boolean;
  };

  if (suppliedKey) {
    encryption = encryptApiKey(suppliedKey);
  } else if (existing) {
    encryption = {
      apiKey: existing.api_key,
      encrypted: Boolean(existing.encrypted)
    };
  } else {
    throw new Error("Please enter an API key.");
  }

  return db.saveProvider({
    ...provider,
    id: existing?.id,
    name,
    provider: providerId,
    apiKey: encryption.apiKey,
    encrypted: encryption.encrypted,
    enabled: provider.enabled !== false
  });
});

ipcMain.handle("providers:list", () => {
  return db.listProviders();
});

ipcMain.handle(
  "providers:test",
  async (_event, providerName: string) => {
    return testAIProvider(providerName);
  }
);

// --------------------------------------------------
// Articles
// --------------------------------------------------

ipcMain.handle("articles:list", () => {
  return db.listArticles();
});

// --------------------------------------------------
// Parallel AI Article Generation
// --------------------------------------------------

ipcMain.handle("articles:generate", async (_event, input) => {
  const jobId = db.createJob(input);

  try {
    const providers = db
      .getEnabledProviders()
      .map((provider: any) => decryptApiKey(provider));

    if (providers.length === 0) {
      throw new Error(
        "No enabled AI providers found. Configure Gemini, Groq or OpenRouter first."
      );
    }

    const results = await runParallelGeneration(
      input,
      providers
    );

    db.saveGenerationResults(jobId, results);

    return {
      jobId,
      results
    };
  } catch (error: any) {
    db.failJob(
      jobId,
      error?.message || "Generation failed"
    );

    throw error;
  }
});

// --------------------------------------------------
// WordPress Draft Publishing
// --------------------------------------------------

ipcMain.handle(
  "articles:publish",
  async (_event, { articleId, siteId }) => {
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

    return result;
  }
);

// --------------------------------------------------
// Article Editing
// --------------------------------------------------

ipcMain.handle("articles:save-edit", (_event, article) => {
  return db.updateArticle(article);
});

// --------------------------------------------------
// Scheduling
// --------------------------------------------------

ipcMain.handle("schedule:add", (_event, item) => {
  return db.addSchedule(item);
});

ipcMain.handle("schedule:list", () => {
  return db.listSchedules();
});

ipcMain.handle("schedule:delete", (_event, id: number) => {
  return db.deleteSchedule(id);
});

// --------------------------------------------------
// Image generation placeholder
// --------------------------------------------------

ipcMain.handle("images:generate", async () => {
  return {
    ok: false,
    message:
      "Image generation adapter is not implemented yet."
  };
});
