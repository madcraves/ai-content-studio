import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("studio", {
  // Dashboard
  dashboard: () => ipcRenderer.invoke("dashboard:get"),

  // WordPress websites
  listSites: () => ipcRenderer.invoke("sites:list"),
  addSite: (site: any) => ipcRenderer.invoke("sites:add", site),
  deleteSite: (id: number) => ipcRenderer.invoke("sites:delete", id),
  testSite: (id: number) => ipcRenderer.invoke("sites:test", id),

  // AI providers
  saveProvider: (provider: any) =>
    ipcRenderer.invoke("providers:save", provider),

  listProviders: () =>
    ipcRenderer.invoke("providers:list"),

  testProvider: (provider: string) =>
    ipcRenderer.invoke("providers:test", provider),

  // Internet connection
  getConnectionStatus: () =>
    ipcRenderer.invoke("network:status"),

  onNetworkStatus: (callback: (status: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: boolean) => {
      callback(status);
    };

    ipcRenderer.on("network:status-changed", listener);

    return () => {
      ipcRenderer.removeListener("network:status-changed", listener);
    };
  },

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

  onScheduled: (callback: (id: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: number) => {
      callback(id);
    };

    ipcRenderer.on("job:scheduled", listener);

    return () => {
      ipcRenderer.removeListener("job:scheduled", listener);
    };
  }
});
