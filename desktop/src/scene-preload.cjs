"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qgScene", Object.freeze({
  onAmbientState: (handler) => {
    const listener = (_event, active) => handler(Boolean(active));
    ipcRenderer.on("qg:ambient-active", listener);
    return () => ipcRenderer.removeListener("qg:ambient-active", listener);
  },
  onSceneState: (handler) => {
    const listener = (_event, snapshot) => handler(snapshot);
    ipcRenderer.on("qg:scene-state", listener);
    return () => ipcRenderer.removeListener("qg:scene-state", listener);
  }
}));
