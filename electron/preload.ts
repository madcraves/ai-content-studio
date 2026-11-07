import { contextBridge, ipcRenderer } from "electron";

type NetworkStatus = {
  online: boolean;
};

contextBridge.exposeInMainWorld("studio", {
  // Offline license activation
  getLicenseStatus: () =>
    ipcRenderer.invoke("license:status"),

  getMachineId: () =>
    ipcRenderer.invoke("license:machine-id"),

  activateLicense: (code: string) =>
    ipcRenderer.invoke("license:activate", code),

  // Dashboard
  dashboard: () =>
    ipcRenderer.invoke("dashboard:get"),

  // WordPress websites
  listSites: () =>
    ipcRenderer.invoke("sites:list"),

  addSite: (site: any) =>
    ipcRenderer.invoke("sites:add", site),

  deleteSite: (id: number) =>
    ipcRenderer.invoke("sites:delete", id),

  testSite: (id: number) =>
    ipcRenderer.invoke("sites:test", id),

  // AI providers
  saveProvider: (provider: any) =>
    ipcRenderer.invoke("providers:save", provider),

  listProviders: () =>
    ipcRenderer.invoke("providers:list"),

  // Pass provider ID consistently from the UI
  testProvider: (providerId: number | string) =>
    ipcRenderer.invoke("providers:test", providerId),

  // Image generation providers and featured article images
  listImageProviders: () => ipcRenderer.invoke("images:providers:list"),
  saveImageProvider: (input: any) => ipcRenderer.invoke("images:providers:save", input),
  generateImage: (input: any) => ipcRenderer.invoke("images:generate", input),
  getArticleImage: (articleId: number) => ipcRenderer.invoke("images:get", articleId),

  // Articles
  listArticles: () =>
    ipcRenderer.invoke("articles:list"),

  generate: (input: any) =>
    ipcRenderer.invoke("articles:generate", input),

  publish: (input: any) =>
    ipcRenderer.invoke("articles:publish", input),

  saveEdit: (article: any) =>
    ipcRenderer.invoke("articles:save-edit", article),

  // Scheduler
  addSchedule: (item: any) =>
    ipcRenderer.invoke("schedule:add", item),

  listSchedules: () =>
    ipcRenderer.invoke("schedule:list"),

  deleteSchedule: (id: number) =>
    ipcRenderer.invoke("schedule:delete", id),

  // Automatic application updates
  getUpdateStatus: () => ipcRenderer.invoke("updates:status"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateStatus: (callback: (status: any) => void) => {
    const listener = (_event: any, status: any) => callback(status);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  },

  // Network status
  getConnectionStatus: async (): Promise<NetworkStatus> => {
    const result = await ipcRenderer.invoke("network:status");

    return {
      online: typeof result === "boolean"
        ? result
        : Boolean(result?.online)
    };
  },

  onNetworkStatus: (callback: (status: NetworkStatus) => void) => {
    const listener = (_event: any, status: any) => {
      callback({
        online: typeof status === "boolean"
          ? status
          : Boolean(status?.online)
      });
    };

    ipcRenderer.on("network:status-changed", listener);

    return () => {
      ipcRenderer.removeListener("network:status-changed", listener);
    };
  },

  // Scheduled job notifications
  onScheduled: (callback: (id: number) => void) => {
    const listener = (_event: any, id: number) => {
      callback(id);
    };

    ipcRenderer.on("job:scheduled", listener);

    return () => {
      ipcRenderer.removeListener("job:scheduled", listener);
    };
  }
});
