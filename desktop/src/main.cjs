"use strict";

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog, screen, shell, powerMonitor, nativeImage } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

if (process.platform !== "win32") {
  app.whenReady().then(() => dialog.showErrorBox("QG Desktop", "Le prototype du widget de bureau cible Windows 10 et Windows 11."));
} else {
  const singleInstance = app.requestSingleInstanceLock();
  if (!singleInstance) app.quit();
  else {
  app.on("second-instance", () => { if (appReady) openPanel(); else secondInstancePending = true; });
  let host = null;
  try { host = require("desktop-host"); }
  catch (error) { console.error("The native Windows desktop layer could not load:", error.message); }
  const CATEGORIES = [
    ["tat", "Boutique", "#fa759e"], ["ate", "Atelier 3D", "#9bd779"], ["dro", "Studio drone", "#58c8dc"],
    ["gar", "Garage trottinette", "#e9ae62"], ["lab", "Labo code", "#aa9df2"], ["ban", "Banque", "#e9d274"],
    ["cor", "Corps", "#6ed8c5"], ["mai", "Maison connectée", "#ef9d69"], ["cry", "Crypto", "#d8c76a"],
    ["vr", "VR et AR", "#c0a0eb"], ["arc", "Arcade", "#eb7985"], ["soc", "Contenu et réseaux", "#74bde3"],
    ["app", "Design visuel", "#dc87be"]
  ];
  const categoryIds = new Set(CATEGORIES.map(([id]) => id));
  const durations = new Set([5, 15, 30, 60, 90]);
  const statuses = new Set(["inbox", "todo", "doing", "done", "archived"]);
  const MAX_TASKS = 500;
  let tray = null;
  let panel = null;
  let scenes = [];
  let lastDesktopState = null;
  let explorerRetry = null;
  let tasksPath = "";
  let settingsPath = "";
  let tasks = [];
  let settings = { side: "right", opacity: 0.82, motion: "measured", startWithWindows: false, panelBounds: null };
  let quitting = false;
  let lastHostRefresh = 0;
  let appReady = false;
  let secondInstancePending = false;
  let tasksRecoveryNeeded = false;
  let tasksLoadedFromBackup = false;
  let taskWriteQueue = Promise.resolve();
  let settingsWriteQueue = Promise.resolve();
  const lastNotices = new Map();

  const safeText = (value, max) => String(value == null ? "" : value).trim().slice(0, max);
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  function cleanTask(value) {
    const source = value && typeof value === "object" ? value : {};
    const category = categoryIds.has(source.category) ? source.category : null;
    const status = statuses.has(source.status) ? source.status : (category ? "todo" : "inbox");
    return {
      id: /^[a-zA-Z0-9_-]{1,80}$/.test(String(source.id || "")) ? String(source.id) : crypto.randomUUID(),
      title: safeText(source.title, 180),
      category,
      status,
      minutes: durations.has(Number(source.minutes)) ? Number(source.minutes) : 15,
      priority: [1, 2, 3].includes(Number(source.priority)) ? Number(source.priority) : 2,
      doneWhen: safeText(source.doneWhen, 300),
      source: safeText(source.source || "personnelle", 30)
    };
  }

  function cleanTaskList(input) {
    if (!Array.isArray(input) || input.length > MAX_TASKS) throw new Error("La liste est invalide ou dépasse 500 tâches.");
    const seen = new Set();
    return input.map(cleanTask).filter((task) => {
      if (!task.title) return false;
      if (seen.has(task.id)) task.id = crypto.randomUUID();
      seen.add(task.id);
      return true;
    });
  }

  function cleanSettings(input) {
    const next = input && typeof input === "object" ? input : {};
    const bounds = next.panelBounds && typeof next.panelBounds === "object" ? next.panelBounds : null;
    const validBounds = bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
      ? { x: Math.round(bounds.x), y: Math.round(bounds.y), width: 420, height: 740 } : null;
    return {
      side: next.side === "left" ? "left" : "right",
      opacity: Math.max(0.62, Math.min(0.96, Number(next.opacity) || 0.82)),
      motion: next.motion === "reduced" ? "reduced" : "measured",
      startWithWindows: Boolean(next.startWithWindows),
      panelBounds: validBounds
    };
  }

  async function atomicWrite(file, text) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    try {
      await fs.writeFile(temporary, text, { encoding: "utf8", flag: "wx" });
      await fs.rename(temporary, file);
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  }

  function queueSettingsWrite() {
    const snapshot = JSON.stringify(settings, null, 2);
    const write = settingsWriteQueue.then(() => atomicWrite(settingsPath, snapshot));
    settingsWriteQueue = write.catch(() => {});
    return write;
  }

  async function readJson(file, fallback) {
    try { return JSON.parse(await fs.readFile(file, "utf8")); }
    catch (error) { if (error && error.code === "ENOENT") return fallback; throw error; }
  }

  function readDesktopHosts() {
    if (!host) return [];
    try { return host.enumerateDesktopHosts(); }
    catch (error) { console.error("Desktop host enumeration failed:", error.message); return []; }
  }

  function monitorBounds(display) {
    const scale = display.scaleFactor || 1;
    return { x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height, scale };
  }

  function chooseHost(hosts, display) {
    const wanted = monitorBounds(display);
    let best = null;
    let bestScore = -1;
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

  function createScene(display, desktopHost) {
    const bounds = display.bounds;
    const win = new BrowserWindow({
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
    win.setIgnoreMouseEvents(true);
    win.setFocusable(false);
    win.loadFile(path.join(__dirname, "scene.html"));
    win.webContents.once("did-finish-load", () => {
      try {
        if (!host) throw new Error("Le module Windows de la couche arrière n’est pas disponible.");
        host.attachToDesktop(win.getNativeWindowHandle(), desktopHost.handle, monitorBounds(display));
        win.showInactive();
        win.webContents.send("qg:ambient-active", false);
        win.webContents.send("qg:scene-state", { categories: CATEGORIES, tasks: publicTasks(), settings });
      } catch (error) {
        console.error("Desktop scene attachment failed:", error.message);
        win.destroy();
      }
    });
    win.on("closed", () => { scenes = scenes.filter((item) => item !== win); });
    scenes.push(win);
  }

  function rebuildScenes() {
    for (const win of scenes) if (!win.isDestroyed()) win.destroy();
    scenes = [];
    const hosts = readDesktopHosts();
    if (!hosts.length) { showShellNotice("Le fond Windows n’a pas pu être détecté; le widget reste masqué pour protéger vos icônes."); return; }
    for (const display of screen.getAllDisplays()) {
      const desktopHost = chooseHost(hosts, display);
      if (desktopHost) createScene(display, desktopHost);
    }
    if (!scenes.length) showShellNotice("Aucune surface de fond Windows compatible n’a été trouvée.");
  }

  function showShellNotice(body) {
    if (!tray) return;
    const now = Date.now();
    if (now - (lastNotices.get(body) || 0) < 900_000) return;
    lastNotices.set(body, now);
    tray.displayBalloon({ title: "QG Desktop", content: body, iconType: "info" });
  }

  function publicTasks() {
    return tasks.map(({ id, title, category, status, minutes, priority, doneWhen }) => ({ id, title, category, status, minutes, priority, doneWhen }));
  }

  function taskSummary() {
    const active = tasks.filter((task) => task.status !== "done" && task.status !== "archived");
    return {
      total: active.length,
      inbox: active.filter((task) => !task.category || task.status === "inbox").length,
      doing: active.filter((task) => task.status === "doing").length,
      completed: tasks.filter((task) => task.status === "done").length
    };
  }

  function syncViews() {
    if (panel && !panel.isDestroyed()) panel.webContents.send("qg:tasks:snapshot", { tasks: publicTasks(), summary: taskSummary(), blocked: tasksRecoveryNeeded });
    for (const scene of scenes) if (!scene.isDestroyed()) scene.webContents.send("qg:scene-state", { categories: CATEGORIES, tasks: publicTasks(), settings });
  }

  function placePanel() {
    if (!panel || panel.isDestroyed()) return;
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const width = 420;
    const height = Math.min(740, area.height - 24);
    const saved = settings.panelBounds;
    let x = saved ? saved.x : (settings.side === "left" ? area.x + 16 : area.x + area.width - width - 16);
    let y = saved ? saved.y : area.y + Math.max(12, Math.round((area.height - height) / 2));
    x = Math.max(area.x + 8, Math.min(x, area.x + area.width - width - 8));
    y = Math.max(area.y + 8, Math.min(y, area.y + area.height - height - 8));
    panel.setBounds({ x, y, width, height });
  }

  function openPanel() {
    if (!panel || panel.isDestroyed()) createPanel();
    placePanel();
    panel.show();
    panel.focus();
    panel.webContents.send("qg:tasks:snapshot", { tasks: publicTasks(), summary: taskSummary(), blocked: tasksRecoveryNeeded });
  }

  function createPanel() {
    panel = new BrowserWindow({
      width: 420, height: 740, show: false, frame: false, transparent: true,
      backgroundColor: "#00000000", resizable: false, movable: true, minimizable: false,
      maximizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: true,
      alwaysOnTop: true, icon: path.join(__dirname, "../assets/qg.ico"),
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"), contextIsolation: true,
        nodeIntegration: false, sandbox: true, backgroundThrottling: true
      }
    });
    panel.setAlwaysOnTop(true, "floating");
    panel.loadFile(path.join(__dirname, "panel.html"));
    panel.on("moved", () => {
      if (!panel || panel.isDestroyed()) return;
      settings.panelBounds = panel.getBounds();
      queueSettingsWrite().catch((error) => console.error("Settings save failed:", error.message));
    });
    panel.on("closed", () => { panel = null; });
  }

  async function persistTasks(next) {
    if (tasksRecoveryNeeded) throw new Error("Le fichier de tâches semble endommagé. Il reste intact; les modifications sont bloquées pour éviter de l’écraser.");
    tasks = cleanTaskList(next);
    const snapshot = JSON.stringify({ format: "qg-personal-tasks", version: 2, tasks }, null, 2);
    const write = taskWriteQueue.then(async () => {
      if (!tasksLoadedFromBackup) {
        try { await atomicWrite(`${tasksPath}.previous`, await fs.readFile(tasksPath, "utf8")); }
        catch (error) { if (!error || error.code !== "ENOENT") throw error; }
      }
      await atomicWrite(tasksPath, snapshot);
      tasksLoadedFromBackup = false;
    });
    taskWriteQueue = write.catch(() => {});
    await write;
    syncViews();
    return { ok: true, summary: taskSummary() };
  }

  async function configureIpc() {
    ipcMain.handle("qg:tasks:read", () => ({ tasks: publicTasks(), summary: taskSummary(), blocked: tasksRecoveryNeeded }));
    ipcMain.handle("qg:tasks:save", async (_event, next) => persistTasks(next));
    ipcMain.handle("qg:tasks:choose-import", async () => {
      const result = await dialog.showOpenDialog(panel, {
        title: "Importer une liste sans la réécrire",
        properties: ["openFile"],
        filters: [{ name: "Tâches QG", extensions: ["txt", "md", "markdown", "json"] }]
      });
      if (result.canceled || !result.filePaths[0]) return null;
      const selected = result.filePaths[0];
      const stat = await fs.stat(selected);
      if (stat.size > 2_000_000) throw new Error("Le fichier dépasse la limite de 2 Mo.");
      return { name: path.basename(selected), text: await fs.readFile(selected, "utf8") };
    });
    ipcMain.handle("qg:tasks:export", async (_event, next) => {
      const safe = cleanTaskList(next);
      const result = await dialog.showSaveDialog(panel, {
        title: "Exporter une copie de vos tâches QG",
        defaultPath: "QG-taches.json",
        filters: [{ name: "Sauvegarde de tâches QG", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      await atomicWrite(result.filePath, JSON.stringify({ format: "qg-personal-tasks", version: 2, tasks: safe }, null, 2));
      return { ok: true, fileName: path.basename(result.filePath) };
    });
    ipcMain.handle("qg:settings:read", () => settings);
    ipcMain.handle("qg:settings:save", async (_event, next) => {
      settings = cleanSettings({ ...settings, ...next });
      app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
      await queueSettingsWrite();
      syncViews();
      return settings;
    });
    ipcMain.handle("qg:site:open", () => shell.openExternal("https://ceomelyxja.github.io/DumbFuckCockpit/"));
    ipcMain.handle("qg:panel:close", () => { if (panel && !panel.isDestroyed()) panel.hide(); });
  }

  function trayMenu() {
    const menu = Menu.buildFromTemplate([
      { label: "Ouvrir le plan de travail", click: openPanel },
      { label: "Actualiser la couche du bureau", click: rebuildScenes },
      { type: "separator" },
      { label: "Ouvrir le cockpit web", click: () => shell.openExternal("https://ceomelyxja.github.io/DumbFuckCockpit/") },
      { type: "separator" },
      { label: "Quitter QG Desktop", click: () => { quitting = true; app.quit(); } }
    ]);
    if (tray) tray.setContextMenu(menu);
  }

  function createTray() {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "../assets/tray.png")));
    tray.setToolTip("QG Desktop · Ctrl+Alt+Space");
    tray.on("double-click", openPanel);
    trayMenu();
  }

  function updateDesktopActivity() {
    let active = false;
    try { active = Boolean(host && host.isDesktopForeground()); } catch (_) {}
    if (lastDesktopState !== active) {
      lastDesktopState = active;
      for (const scene of scenes) if (!scene.isDestroyed()) scene.webContents.send("qg:ambient-active", active);
    }
  }

  function maintainShell() {
    const now = Date.now();
    if (now - lastHostRefresh > 8000) {
      lastHostRefresh = now;
      const hosts = readDesktopHosts();
      const current = new Set(hosts.map((entry) => entry.handle));
      const shouldRebuild = scenes.some((scene) => {
        if (scene.isDestroyed()) return true;
        if (scene.webContents.isLoading()) return false;
        const parent = host ? host.getParentHandle(scene.getNativeWindowHandle()) : null;
        return !current.size || !parent || !current.has(parent);
      });
      if (!scenes.length || shouldRebuild) rebuildScenes();
    }
    updateDesktopActivity();
  }

  app.whenReady().then(async () => {
    app.setAppUserModelId("ca.ceomelyxja.qgdesktop");
    const storeRoot = path.join(app.getPath("userData"), "qg");
    tasksPath = path.join(storeRoot, "tasks.json");
    settingsPath = path.join(storeRoot, "settings.json");
    try {
      const raw = await readJson(tasksPath, { tasks: [] });
      if (!raw || !Array.isArray(raw.tasks)) throw new Error("Le format local de la liste n’est pas reconnu.");
      tasks = cleanTaskList(raw.tasks);
    } catch (error) {
      try {
        const previous = await readJson(`${tasksPath}.previous`, null);
        if (!previous || !Array.isArray(previous.tasks)) throw error;
        tasks = cleanTaskList(previous.tasks);
        tasksLoadedFromBackup = true;
        showShellNotice("Une copie locale précédente a été reprise; le fichier original reste conservé.");
      } catch (_) {
        tasksRecoveryNeeded = true;
        showShellNotice("Le fichier de tâches ne peut pas être lu. QG Desktop le conserve sans l’écraser.");
        tasks = [];
      }
    }
    try { settings = cleanSettings(await readJson(settingsPath, settings)); }
    catch (error) { showShellNotice(`Les préférences n’ont pas pu être lues : ${error.message}`); }
    app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
    await configureIpc();
    createTray();
    rebuildScenes();
    if (!globalShortcut.register("Control+Alt+Space", openPanel)) showShellNotice("Le raccourci Ctrl+Alt+Espace est déjà utilisé par une autre application.");
    globalShortcut.register("Control+Alt+Shift+Space", rebuildScenes);
    screen.on("display-added", rebuildScenes);
    screen.on("display-removed", rebuildScenes);
    screen.on("display-metrics-changed", rebuildScenes);
    powerMonitor.on("suspend", () => { for (const scene of scenes) if (!scene.isDestroyed()) scene.webContents.send("qg:ambient-active", false); });
    powerMonitor.on("resume", updateDesktopActivity);
    explorerRetry = setInterval(maintainShell, 1400);
    app.on("activate", openPanel);
    appReady = true;
    if (secondInstancePending) openPanel();
  });

  app.on("before-quit", () => { quitting = true; if (explorerRetry) clearInterval(explorerRetry); });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("window-all-closed", () => {});
  app.on("browser-window-created", (_event, window) => {
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("file:")) event.preventDefault();
    });
  });
  }
}
