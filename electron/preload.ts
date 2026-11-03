import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("studio", {
  dashboard: () => ipcRenderer.invoke("dashboard:get"),
  listSites: () => ipcRenderer.invoke("sites:list"),
  addSite: (site: any) => ipcRenderer.invoke("sites:add", site),
  deleteSite: (id: number) => ipcRenderer.invoke("sites:delete", id),
  saveProvider: (p: any) => ipcRenderer.invoke("providers:save", p),
  listProviders: () => ipcRenderer.invoke("providers:list"),
  listArticles: () => ipcRenderer.invoke("articles:list"),
  generate: (input: any) => ipcRenderer.invoke("articles:generate", input),
  publish: (input: any) => ipcRenderer.invoke("articles:publish", input),
  saveEdit: (article: any) => ipcRenderer.invoke("articles:save-edit", article),
  addSchedule: (item: any) => ipcRenderer.invoke("schedule:add", item),
  listSchedules: () => ipcRenderer.invoke("schedule:list"),
  deleteSchedule: (id: number) => ipcRenderer.invoke("schedule:delete", id),
  onScheduled: (cb: (id: number) => void) => ipcRenderer.on("job:scheduled", (_e, id) => cb(id))
});
