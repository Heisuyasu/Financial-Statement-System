import { contextBridge, ipcRenderer } from "electron";

const api = {
  entries: {
    list: (year: number, month?: number) =>
      ipcRenderer.invoke("entries:list", year, month),
    create: (input: unknown) => ipcRenderer.invoke("entries:create", input),
    update: (input: unknown) => ipcRenderer.invoke("entries:update", input),
    delete: (section: string, id: number) =>
      ipcRenderer.invoke("entries:delete", section, id),
    search: (query: string, year?: number) =>
      ipcRenderer.invoke("entries:search", query, year),
  },
  company: {
    get: () => ipcRenderer.invoke("company:get"),
    update: (data: unknown) => ipcRenderer.invoke("company:update", data),
  },
  settings: {
    getAll: () => ipcRenderer.invoke("settings:getAll"),
    set: (key: string, value: string) =>
      ipcRenderer.invoke("settings:set", key, value),
  },
  audit: {
    list: (limit?: number) => ipcRenderer.invoke("audit:list", limit),
  },
  user: {
    get: () => ipcRenderer.invoke("user:get"),
  },
  file: {
    save: (
      options: { defaultName: string; filterName: string; extensions: string[] },
      data: ArrayBuffer
    ) => ipcRenderer.invoke("file:save", options, data),
  },
  logo: {
    pick: () => ipcRenderer.invoke("logo:pick"),
  },
  db: {
    backup: () => ipcRenderer.invoke("db:backup"),
    restore: () => ipcRenderer.invoke("db:restore"),
    restoreFrom: (path: string) => ipcRenderer.invoke("db:restoreFrom", path),
    autoBackups: () => ipcRenderer.invoke("db:autoBackups"),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronApi = typeof api;
