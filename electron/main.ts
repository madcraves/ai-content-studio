import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";

import { Database } from "./services/database";
import { runParallelGeneration } from "./services/generation";
import { publishDraft } from "./services/wordpress";
import { startScheduler } from "./services/scheduler";
import {
  getMachineId,
  getLicenseStatus,
  activateLicense
} from "./services/license";

let win: BrowserWindow | null = null;
let db: Database;

const licenseFile = () =>
  path.join(app.getPath("userData"), "license.json");

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
  const dataPath = path.join(portableBase, "AI-Content-Studio-Data");

  app.setPath("userData", dataPath);
  app.setPath("sessionData", path.join(dataPath, "session"));
}

// --------------------------------------------------
// License protection
// --------------------------------------------------

function requireValidLicense(): void {
  const status = getLicenseStatus(licenseFile());

  if (!status.valid) {
    throw new Error(
      status.message || "A valid activation license is required."
    );
  }
}

// These three handlers remain available before activation.
ipcMain.handle("license:machine-id", () => getMachineId());

ipcMain.handle("license:status", () =>
  getLicenseStatus(licenseFile())
);

ipcMain.handle("license:activate", (_event, code: string) => {
  if (typeof code !== "string" || !code.trim()) {
    throw new Error("Please enter your activation code.");
  }

  activateLicense(licenseFile(), code.trim());
  return getLicenseStatus(licenseFile());
});

// --------------------------------------------------
// Encryption helpers
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
    encrypted: encryptionAvailable
  };
}

function decryptApiKey(provider: any): any {
  const storedKey = provider.api_key ?? provider.apiKey ?? "";
  let apiKey = "";

  if (storedKey) {
    apiKey =
      provider.encrypted && safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(storedKey, "base64"))
        : Buffer.from(storedKey, "base64").toString("utf8");
  }

  return { ...provider, apiKey };
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
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.on("closed", () => {
    win = null;
  });
}

// --------------------------------------------------
// Application initialization
// --------------------------------------------------

app.whenReady().then(() => {
  const dataDir = app.getPath("userData");
  fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(path.join(dataDir, "studio.sqlite"));

  startScheduler(db, async (scheduleId: number) => {
    requireValidLicense();

    const schedule = db.getSchedule(scheduleId);
    if (!schedule) return;

    const providers = db
      .getEnabledProviders()
      .map((provider: any) => decryptApiKey(provider));

    if (!providers.length) {
      throw new Error("No enabled AI providers are configured.");
    }

    const jobId = db.createJob({
      topic: schedule.topic,
      siteId: schedule.site_id
    });

    try {
      const results = await runParallelGeneration(
        {
          topic: schedule.topic,
          keyword: schedule.topic,
          wordCount: 2000
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
// Application shutdown
// --------------------------------------------------

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (db) db.close();
});

// --------------------------------------------------
// Dashboard
// --------------------------------------------------

ipcMain.handle("dashboard:get", () => {
  requireValidLicense();
  return db.dashboard();
});

// --------------------------------------------------
// Websites
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

// --------------------------------------------------
// AI Providers
// --------------------------------------------------

ipcMain.handle("providers:save", (_event, provider) => {
  requireValidLicense();

  const encryption = encryptApiKey(
    provider.apiKey ?? provider.api_key ?? ""
  );

  db.saveProvider({
    ...provider,
    apiKey: encryption.apiKey,
    encrypted: encryption.encrypted
  });

  return { ok: true };
});

ipcMain.handle("providers:list", () => {
  requireValidLicense();
  return db.listProviders();
});

// --------------------------------------------------
// Articles
// --------------------------------------------------

ipcMain.handle("articles:list", () => {
  requireValidLicense();
  return db.listArticles();
});

ipcMain.handle("articles:generate", async (_event, input) => {
  requireValidLicense();

  const jobId = db.createJob(input);

  try {
    const providers = db
      .getEnabledProviders()
      .map((provider: any) => decryptApiKey(provider));

    if (providers.length === 0) {
      throw new Error(
        "No enabled AI providers found. Configure a provider first."
      );
    }

    const results = await runParallelGeneration(input, providers);
    db.saveGenerationResults(jobId, results);

    return { jobId, results };
  } catch (error: any) {
    db.failJob(jobId, error?.message || "Generation failed");
    throw error;
  }
});

// --------------------------------------------------
// WordPress draft publishing
// --------------------------------------------------

ipcMain.handle(
  "articles:publish",
  async (_event, { articleId, siteId }) => {
    requireValidLicense();

    const article = db.getArticle(articleId);
    if (!article) throw new Error("Article not found.");

    const site = db.getSite(siteId);
    if (!site) throw new Error("WordPress website not found.");

    const result = await publishDraft(site, article);
    db.markPublished(articleId);

    return result;
  }
);

// --------------------------------------------------
// Article editing
// --------------------------------------------------

ipcMain.handle("articles:save-edit", (_event, article) => {
  requireValidLicense();
  return db.updateArticle(article);
});

// --------------------------------------------------
// Scheduling
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
// Image generation placeholder
// --------------------------------------------------

ipcMain.handle("images:generate", async () => {
  requireValidLicense();

  return {
    ok: false,
    message: "Image generation adapter is not implemented yet."
  };
});
