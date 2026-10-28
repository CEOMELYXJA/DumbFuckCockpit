"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qgDesktop", Object.freeze({
  getTasks: () => ipcRenderer.invoke("qg:tasks:read"),
  saveTasks: (tasks) => ipcRenderer.invoke("qg:tasks:save", tasks),
  chooseImport: () => ipcRenderer.invoke("qg:tasks:choose-import"),
  exportTasks: (tasks) => ipcRenderer.invoke("qg:tasks:export", tasks),
  getSettings: () => ipcRenderer.invoke("qg:settings:read"),
  saveSettings: (settings) => ipcRenderer.invoke("qg:settings:save", settings),
  getAmbientStatus: () => ipcRenderer.invoke("qg:ambient:status"),
  onAmbientStatus: (handler) => {
    const listener = (_event, status) => handler(status);
    ipcRenderer.on("qg:ambient:status", listener);
    return () => ipcRenderer.removeListener("qg:ambient:status", listener);
  },
  onSettingsOpen: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("qg:settings:open", listener);
    return () => ipcRenderer.removeListener("qg:settings:open", listener);
  },
  openSite: () => ipcRenderer.invoke("qg:site:open"),
  closePanel: () => ipcRenderer.invoke("qg:panel:close"),
  onAmbientState: (handler) => {
    const listener = (_event, active) => handler(Boolean(active));
    ipcRenderer.on("qg:ambient-active", listener);
    return () => ipcRenderer.removeListener("qg:ambient-active", listener);
  },
  onSceneState: (handler) => {
    const listener = (_event, snapshot) => handler(snapshot);
    ipcRenderer.on("qg:scene-state", listener);
    return () => ipcRenderer.removeListener("qg:scene-state", listener);
  },
  onSnapshot: (handler) => {
    const listener = (_event, snapshot) => handler(snapshot);
    ipcRenderer.on("qg:tasks:snapshot", listener);
    return () => ipcRenderer.removeListener("qg:tasks:snapshot", listener);
  }
}));

