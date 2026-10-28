"use strict";

const { app, BrowserWindow, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const profile = process.env.QG_AMBIENT_PROFILE;
if (profile) {
  fs.mkdirSync(profile, { recursive: true });
  app.setPath("userData", profile);
}

let nativeHost = null;
let snapshot = { categories: [], tasks: [], settings: { side: "right", opacity: 0.82, motion: "measured" } };
let scenes = [];
let receivedSnapshot = false;
let lastDesktopActivity = null;
let lastUnavailableNotice = 0;
let refreshTimer = null;
let shuttingDown = false;
let lastShellScan = 0;
let cachedHosts = [];

const sendToParent = (message) => {
  if (process.connected) process.send(message);
};

function reportStatus(status, message) {
  sendToParent({ type: "status", payload: { status, message } });
}

function readHosts() {
  if (!nativeHost) return [];
  try { return nativeHost.enumerateDesktopHosts(); }
  catch (error) { sendToParent({ type: "shell-error", message: error.message }); return []; }
}

function monitorBounds(display) {
  return {
    x: display.bounds.x, y: display.bounds.y,
    width: display.bounds.width, height: display.bounds.height,
    scale: display.scaleFactor || 1
  };
}

function widgetBounds(display) {
  const source = display.bounds;
  const width = Math.max(1, Math.min(source.width, Math.round(source.width * 0.68)));
  return {
    x: snapshot.settings?.side === "left" ? source.x : source.x + source.width - width,
    y: source.y,
    width,
    height: source.height
  };
}

function chooseHost(hosts, display) {
  const wanted = monitorBounds(display);
  let best = null, bestScore = -1;
  for (const candidate of hosts) {
    const r = candidate.bounds;
    const left = Math.max(wanted.x, r.x / wanted.scale);
    const top = Math.max(wanted.y, r.y / wanted.scale);
    const right = Math.min(wanted.x + wanted.width, (r.x + r.width) / wanted.scale);
    const bottom = Math.min(wanted.y + wanted.height, (r.y + r.height) / wanted.scale);
    const score = Math.max(0, right - left) * Math.max(0, bottom - top);
    if (score > bestScore) { best = candidate; bestScore = score; }
  }
  return best;
}

function broadcastState() {
  const message = { categories: snapshot.categories, tasks: snapshot.tasks, settings: snapshot.settings };
  for (const window of scenes) if (!window.isDestroyed() && !window.webContents.isLoading()) window.webContents.send("qg:scene-state", message);
}

function broadcastActivity(active) {
  if (active === lastDesktopActivity) return;
  lastDesktopActivity = active;
  for (const window of scenes) if (!window.isDestroyed() && !window.webContents.isLoading()) window.webContents.send("qg:ambient-active", active);
}

function notifyUnavailable(message) {
  reportStatus("unavailable", message);
  const now = Date.now();
  if (now - lastUnavailableNotice < 900_000) return;
  lastUnavailableNotice = now;
  sendToParent({ type: "shell-unavailable", message });
}

function createScene(display, desktopHost) {
  const bounds = widgetBounds(display);
  const displayZone = { ...display, bounds };
  const window = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    show: false, frame: false, transparent: true, backgroundColor: "#00000000",
    resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, focusable: false, skipTaskbar: true, hasShadow: false,
    paintWhenInitiallyHidden: false,
    webPreferences: {
      preload: path.join(__dirname, "scene-preload.cjs"), contextIsolation: true,
      nodeIntegration: false, sandbox: true, backgroundThrottling: false
    }
  });
  window.setIgnoreMouseEvents(true);
  window.setFocusable(false);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) event.preventDefault();
  });
  const cockpitEntry = app.isPackaged
    ? path.join(process.resourcesPath, "widget", "index.html")
    : path.resolve(__dirname, "../../index.html");
  window.loadFile(cockpitEntry, { query: { desktopWidget: "1" } });
  window.webContents.once("did-finish-load", () => {
    try {
      if (!nativeHost) throw new Error("Le module Windows de la couche arrière n’est pas disponible.");
      nativeHost.attachToDesktop(window.getNativeWindowHandle(), desktopHost.handle, monitorBounds(displayZone));
      window.showInactive();
      window.webContents.send("qg:scene-state", { categories: snapshot.categories, tasks: snapshot.tasks, settings: snapshot.settings });
      window.webContents.send("qg:ambient-active", false);
      reportStatus("visible", "Widget transparent actif derrière les icônes.");
    } catch (error) {
      reportStatus("unavailable", "Windows n’a pas pu afficher le widget derrière les icônes.");
      sendToParent({ type: "attach-error", message: error.message });
      window.destroy();
    }
  });
  window.on("closed", () => { scenes = scenes.filter((item) => item !== window); });
  scenes.push(window);
}

function rebuildScenes() {
  for (const window of scenes) if (!window.isDestroyed()) window.destroy();
  scenes = [];
  if (!receivedSnapshot) return;
  if (snapshot.settings?.fieldEnabled === false) { reportStatus("hidden", "Widget transparent masqué dans les préférences."); return; }
  reportStatus("starting", "Recherche de la couche arrière du bureau Windows…");
  cachedHosts = readHosts();
  lastShellScan = Date.now();
  const hosts = cachedHosts;
  if (!hosts.length) {
    notifyUnavailable("Le fond Windows n’a pas pu être détecté; la scène reste masquée pour protéger vos icônes.");
    return;
  }
  let created = 0;
  for (const display of screen.getAllDisplays()) {
    const host = chooseHost(hosts, display);
    if (host) { createScene(display, host); created++; }
  }
  if (!created) notifyUnavailable("Aucune surface de fond Windows compatible n’a été trouvée.");
  else reportStatus("starting", "Installation du widget derrière les icônes…");
}

function checkShell() {
  if (!receivedSnapshot || snapshot.settings?.fieldEnabled === false) return;
  if (Date.now() - lastShellScan > 8000) {
    cachedHosts = readHosts();
    lastShellScan = Date.now();
  }
  const hosts = cachedHosts;
  const current = new Set(hosts.map((entry) => entry.handle));
  const missing = scenes.some((window) => {
    if (window.isDestroyed() || window.webContents.isLoading()) return false;
    const parent = nativeHost ? nativeHost.getParentHandle(window.getNativeWindowHandle()) : null;
    return !current.size || !parent || !current.has(parent);
  });
  if (missing || (!scenes.length && current.size)) rebuildScenes();
  try { broadcastActivity(Boolean(nativeHost && nativeHost.isDesktopForeground())); }
  catch (_) { broadcastActivity(false); }
}

process.on("message", (message) => {
  if (!message || typeof message !== "object") return;
  if (message.type === "snapshot" && message.payload && typeof message.payload === "object") {
    const previousSide = snapshot.settings?.side;
    snapshot = message.payload;
    receivedSnapshot = true;
    if (snapshot.settings?.fieldEnabled === false || !scenes.length || previousSide !== snapshot.settings?.side) rebuildScenes();
    else broadcastState();
  } else if (message.type === "rebuild") {
    rebuildScenes();
  } else if (message.type === "shutdown") {
    shuttingDown = true;
    if (refreshTimer) clearInterval(refreshTimer);
    for (const window of scenes) if (!window.isDestroyed()) window.destroy();
    app.quit();
  }
});

process.on("disconnect", () => {
  shuttingDown = true;
  if (refreshTimer) clearInterval(refreshTimer);
  if (app.isReady()) app.quit();
});

app.whenReady().then(() => {
  if (process.platform !== "win32") { sendToParent({ type: "shell-unavailable", message: "La couche arrière cible Windows." }); app.quit(); return; }
  try { nativeHost = require("desktop-host"); }
  catch (error) { sendToParent({ type: "shell-unavailable", message: `Le module de bureau Windows ne s’est pas chargé : ${error.message}` }); }
  if (shuttingDown) { app.quit(); return; }
  app.setAppUserModelId("ca.ceomelyxja.qgdesktop.ambient");
  screen.on("display-added", rebuildScenes);
  screen.on("display-removed", rebuildScenes);
  screen.on("display-metrics-changed", rebuildScenes);
  refreshTimer = setInterval(checkShell, 1400);
  checkShell();
  sendToParent({ type: "ready" });
});

app.on("window-all-closed", () => { if (shuttingDown) app.quit(); });

