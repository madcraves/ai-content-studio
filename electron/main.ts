import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";

import { Database } from "./services/database";
import { runParallelGeneration } from "./services/generation";
import { publishDraft } from "./services/wordpress";
import { startScheduler } from "./services/scheduler";

let win: BrowserWindow | null = null;
let db: Database;

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
        ? safeStorage.decryptString(
            Buffer.from(storedKey, "base64")
          )
        : Buffer.from(storedKey, "base64").toString("utf8");
  }

  return {
    ...provider,
    apiKey
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

app.whenReady().then(() => {
  const dataDir = app.getPath("userData");

  fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(
    path.join(dataDir, "studio.sqlite")
  );

  // Start automatic scheduler
  startScheduler(db, (jobId: number) => {
    win?.webContents.send("job:scheduled", jobId);
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
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
// Websites
// --------------------------------------------------

ipcMain.handle("sites:list", () => {
  return db.listSites();
});

ipcMain.handle("sites:add", (_e, site) => {
  return db.addSite(site);
});

ipcMain.handle("sites:delete", (_e, id) => {
  return db.deleteSite(id);
});

// --------------------------------------------------
// AI Providers
// --------------------------------------------------

ipcMain.handle("providers:save", (_e, provider) => {
  const encryption = encryptApiKey(provider.apiKey ?? provider.api_key ?? "");

  db.saveProvider({
    ...provider,
    apiKey: encryption.apiKey,
    encrypted: encryption.encrypted
  });

  return { ok: true };
});

ipcMain.handle("providers:list", () => {
  return db.listProviders();
});

// --------------------------------------------------
// Articles
// --------------------------------------------------

ipcMain.handle("articles:list", () => {
  return db.listArticles();
});

// --------------------------------------------------
// Parallel AI Article Generation
// --------------------------------------------------

ipcMain.handle("articles:generate", async (_e, input) => {
  const jobId = db.createJob(input);

  try {
    const providers = db
      .getEnabledProviders()
      .map((provider: any) => decryptApiKey(provider));

    if (providers.length === 0) {
      throw new Error(
        "No enabled AI providers found. Please configure an AI provider first."
      );
    }

    // Run all enabled AI providers in parallel
    const results = await runParallelGeneration(
      input,
      providers
    );

    // Save generated articles using the current database signature
    db.saveGenerationResults(jobId, results);

    return {
      jobId,
      results
    };
  } catch (err: any) {
    db.failJob(
      jobId,
      err?.message || "Generation failed"
    );

    throw err;
  }
});

// --------------------------------------------------
// WordPress Draft Publishing
// --------------------------------------------------

ipcMain.handle(
  "articles:publish",
  async (_e, { articleId, siteId }) => {
    const article = db.getArticle(articleId);

    if (!article) {
      throw new Error("Article not found.");
    }

    const site = db.getSite(siteId);

    if (!site) {
      throw new Error("WordPress website not found.");
    }

    const result = await publishDraft(site, article);

    // Current database method accepts only article ID
    db.markPublished(articleId);

    return result;
  }
);

// --------------------------------------------------
// Article Editing
// --------------------------------------------------

ipcMain.handle("articles:save-edit", (_e, article) => {
  return db.updateArticle(article);
});

// --------------------------------------------------
// Automatic Scheduling
// --------------------------------------------------

ipcMain.handle("schedule:add", (_e, item) => {
  return db.addSchedule(item);
});

ipcMain.handle("schedule:list", () => {
  return db.listSchedules();
});

ipcMain.handle("schedule:delete", (_e, id) => {
  return db.deleteSchedule(id);
});

// --------------------------------------------------
// Image Generation Extension Point
// --------------------------------------------------

ipcMain.handle("images:generate", async () => {
  return {
    ok: false,
    message:
      "Image generation adapter is not implemented in V1."
  };
});
