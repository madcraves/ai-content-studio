import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";

import { Database } from "./services/database";
import { runParallelGeneration } from "./services/generation";
import { publishDraft } from "./services/wordpress";
import { startScheduler } from "./services/scheduler";

let win: BrowserWindow;
let db: Database;

// Keep portable application data beside the EXE.
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

function createWindow() {
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
}

app.whenReady().then(() => {
  const dataDir = app.getPath("userData");

  fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(
    path.join(dataDir, "studio.sqlite")
  );

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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Dashboard
ipcMain.handle("dashboard:get", () => db.dashboard());

// Websites
ipcMain.handle("sites:list", () => db.listSites());

ipcMain.handle("sites:add", (_e, site) =>
  db.addSite(site)
);

ipcMain.handle("sites:delete", (_e, id) =>
  db.deleteSite(id)
);

// AI Providers
ipcMain.handle("providers:save", (_e, provider) => {
  const encrypted = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(provider.apiKey).toString("base64")
    : Buffer.from(provider.apiKey).toString("base64");

  db.saveProvider({
    ...provider,
    apiKey: encrypted,
    encrypted: safeStorage.isEncryptionAvailable()
  });

  return { ok: true };
});

ipcMain.handle("providers:list", () =>
  db.listProviders().map(({ apiKey, ...p }: any) => p)
);

// Articles
ipcMain.handle("articles:list", () =>
  db.listArticles()
);

ipcMain.handle("articles:generate", async (_e, input) => {
  const jobId = db.createJob(input);

  try {
    const providers = db.getEnabledProviders().map((p: any) => ({
      ...p,
      apiKey:
        p.encrypted && safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(
              Buffer.from(p.apiKey, "base64")
            )
          : Buffer.from(p.apiKey, "base64").toString("utf8")
    }));

    const results = await runParallelGeneration(
      input,
      providers
    );

    db.saveGenerationResults(jobId, input, results);

    return { jobId, results };
  } catch (err: any) {
    db.failJob(
      jobId,
      err?.message || "Generation failed"
    );

    throw err;
  }
});

// WordPress Draft Publishing
ipcMain.handle(
  "articles:publish",
  async (_e, { articleId, siteId }) => {
    const article = db.getArticle(articleId);
    const site = db.getSite(siteId);

    const result = await publishDraft(site, article);

    db.markPublished(articleId, result);

    return result;
  }
);

ipcMain.handle("articles:save-edit", (_e, article) =>
  db.updateArticle(article)
);

// Scheduler
ipcMain.handle("schedule:add", (_e, item) =>
  db.addSchedule(item)
);

ipcMain.handle("schedule:list", () =>
  db.listSchedules()
);

ipcMain.handle("schedule:delete", (_e, id) =>
  db.deleteSchedule(id)
);

// Image generation extension point
ipcMain.handle("images:generate", async () => ({
  ok: false,
  message:
    "Image generation adapter is not implemented in V1."
}));
