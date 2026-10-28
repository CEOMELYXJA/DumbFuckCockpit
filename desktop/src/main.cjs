"use strict";

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, dialog, screen, shell, nativeImage } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

if (process.argv.includes("--qg-ambient-host")) {
  require("./ambient.cjs");
} else if (process.platform !== "win32") {
  app.whenReady().then(() => dialog.showErrorBox("DumbFuckCockpit Widget", "Le widget transparent cible Windows 10 et Windows 11."));
} else {
  const singleInstance = app.requestSingleInstanceLock();
  if (!singleInstance) app.quit();
  else {
  app.on("second-instance", () => { if (appReady) openPanel(); else secondInstancePending = true; });
  const CATEGORIES = [
    ["tat", "Boutique", "#b77f83"], ["ate", "Atelier 3D", "#8e9d7b"], ["dro", "Studio drone", "#77979a"],
    ["gar", "Garage trottinette", "#b38c63"], ["lab", "Labo code", "#9586a6"], ["ban", "Banque", "#b8a477"],
    ["cor", "Corps", "#78a398"], ["mai", "Maison connectée", "#ad8068"], ["cry", "Crypto", "#a39870"],
    ["vr", "VR et AR", "#9685a3"], ["arc", "Arcade", "#b47a7d"], ["soc", "Contenu et réseaux", "#7992a1"],
    ["app", "Design visuel", "#a87d98"]
  ];
  const categoryIds = new Set(CATEGORIES.map(([id]) => id));
  const durations = new Set([5, 15, 30, 60, 90]);
  const statuses = new Set(["inbox", "todo", "doing", "done", "archived"]);
  const MAX_TASKS = 500;
  let tray = null;
  let panel = null;
  let ambientProcess = null;
  let ambientRestartTimer = null;
  let ambientStatus = { status: "starting", message: "Démarrage du widget transparent…" };
  let tasksPath = "";
  let settingsPath = "";
  let tasks = [];
  let settings = { side: "right", opacity: 0.82, motion: "measured", fieldEnabled: true, startWithWindows: false, panelBounds: null };
  let quitting = false;
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
      fieldEnabled: next.fieldEnabled !== false,
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

  function ambientSnapshot() {
    return { categories: CATEGORIES, tasks: publicTasks(), settings };
  }

  function setAmbientStatus(status, message) {
    ambientStatus = { status, message };
    if (panel && !panel.isDestroyed() && !panel.webContents.isLoading()) panel.webContents.send("qg:ambient:status", ambientStatus);
  }

  function sendAmbient(type, payload) {
    if (!ambientProcess || !ambientProcess.connected) return false;
    try { ambientProcess.send({ type, payload }); return true; }
    catch (error) { console.error("Ambient host message failed:", error.message); return false; }
  }

  function requestAmbientRebuild() {
    if (!sendAmbient("rebuild")) startAmbientHost();
  }

  function startAmbientHost() {
    if (quitting || !settings.fieldEnabled || ambientRestartTimer) return;
    if (ambientProcess && ambientProcess.exitCode === null && !ambientProcess.killed) {
      if (ambientProcess.connected) return;
      ambientProcess.kill();
      ambientProcess = null;
    }
    setAmbientStatus("starting", "Démarrage du widget transparent…");
    const profile = path.join(app.getPath("temp"), `QG-Desktop-Ambient-${process.pid}`);
    const args = app.isPackaged ? ["--qg-ambient-host"] : [path.resolve(__dirname, ".."), "--qg-ambient-host"];
    let child;
    try {
      child = spawn(process.execPath, args, {
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        env: { ...process.env, QG_AMBIENT_PROFILE: profile }
      });
    } catch (error) {
      setAmbientStatus("unavailable", "Le widget n’a pas pu démarrer.");
      showShellNotice(`La couche de fond n’a pas démarré : ${error.message}`);
      return;
    }
    ambientProcess = child;
    child.on("message", (message) => {
      if (!message || typeof message !== "object") return;
      if (message.type === "status" && message.payload) setAmbientStatus(message.payload.status, message.payload.message);
      if (message.type === "shell-unavailable" || message.type === "attach-error" || message.type === "shell-error") {
        setAmbientStatus("unavailable", message.message || "La couche Windows reste masquée pour protéger vos icônes.");
        showShellNotice(message.message || "La couche de fond Windows reste masquée pour protéger vos icônes.");
      }
      if (message.type === "ready") sendAmbient("snapshot", ambientSnapshot());
    });
    child.on("error", (error) => { setAmbientStatus("unavailable", "Le widget transparent s’est arrêté."); showShellNotice(`La couche de fond s’est arrêtée : ${error.message}`); });
    child.on("close", () => {
      if (ambientProcess === child) ambientProcess = null;
      if (quitting || !settings.fieldEnabled) return;
      setAmbientStatus("starting", "Redémarrage du widget transparent…");
      showShellNotice("La couche de fond redémarre; le plan de travail reste disponible.");
      ambientRestartTimer = setTimeout(() => { ambientRestartTimer = null; startAmbientHost(); }, 2200);
      ambientRestartTimer.unref?.();
    });
    child.once("spawn", () => sendAmbient("snapshot", ambientSnapshot()));
  }

  function stopAmbientHost() {
    setAmbientStatus("hidden", "Le widget transparent est masqué.");
    if (!ambientProcess) return;
    const child = ambientProcess;
    ambientProcess = null;
    if (child.connected) {
      try { child.send({ type: "shutdown" }); child.disconnect(); }
      catch (_) { child.kill(); }
    } else child.kill();
  }

  function showShellNotice(body) {
    if (!tray) return;
    const now = Date.now();
    if (now - (lastNotices.get(body) || 0) < 900_000) return;
    lastNotices.set(body, now);
    tray.displayBalloon({ title: "DumbFuckCockpit Widget", content: body, iconType: "info" });
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
    sendAmbient("snapshot", ambientSnapshot());
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
    const showPreferences = arguments[0] === true;
    if (!panel || panel.isDestroyed()) createPanel();
    const target = panel;
    placePanel();
    target.show();
    target.focus();
    const sendPanelState = () => {
      if (!target || target.isDestroyed()) return;
      target.webContents.send("qg:tasks:snapshot", { tasks: publicTasks(), summary: taskSummary(), blocked: tasksRecoveryNeeded });
      target.webContents.send("qg:ambient:status", ambientStatus);
      if (showPreferences) target.webContents.send("qg:settings:open");
    };
    if (target.webContents.isLoading()) target.webContents.once("did-finish-load", sendPanelState);
    else sendPanelState();
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
    const cleaned = cleanTaskList(next);
    const snapshot = JSON.stringify({ format: "qg-personal-tasks", version: 2, tasks: cleaned }, null, 2);
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
    tasks = cleaned;
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
        filters: [{ name: "Tâches DumbFuckCockpit", extensions: ["txt", "md", "markdown", "json"] }]
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
        title: "Exporter une copie de vos tâches DumbFuckCockpit",
        defaultPath: "DumbFuckCockpit-taches.json",
        filters: [{ name: "Sauvegarde de tâches DumbFuckCockpit", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      await atomicWrite(result.filePath, JSON.stringify({ format: "qg-personal-tasks", version: 2, tasks: safe }, null, 2));
      return { ok: true, fileName: path.basename(result.filePath) };
    });
    ipcMain.handle("qg:settings:read", () => settings);
    ipcMain.handle("qg:ambient:status", () => ambientStatus);
    ipcMain.handle("qg:settings:save", async (_event, next) => {
      const previous = settings;
      settings = cleanSettings({ ...settings, ...next });
      try { await queueSettingsWrite(); }
      catch (error) { settings = previous; throw error; }
      app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
      syncViews();
      if (settings.fieldEnabled) startAmbientHost(); else stopAmbientHost();
      return settings;
    });
    ipcMain.handle("qg:site:open", () => shell.openExternal("https://ceomelyxja.github.io/DumbFuckCockpit/"));
    ipcMain.handle("qg:panel:close", () => { if (panel && !panel.isDestroyed()) panel.hide(); });
  }

  function trayMenu() {
    const menu = Menu.buildFromTemplate([
      { label: "Ouvrir DumbFuckCockpit", click: openPanel },
      { label: "Réglages du widget", click: () => openPanel(true) },
      { label: settings.fieldEnabled ? "Masquer le widget transparent" : "Afficher le widget transparent", click: toggleAmbientField },
      { label: "Recréer le widget du bureau", enabled: settings.fieldEnabled, click: requestAmbientRebuild },
      { type: "separator" },
      { label: "Ouvrir le cockpit web", click: () => shell.openExternal("https://ceomelyxja.github.io/DumbFuckCockpit/") },
      { type: "separator" },
      { label: "Quitter DumbFuckCockpit Widget", click: () => { quitting = true; app.quit(); } }
    ]);
    if (tray) tray.setContextMenu(menu);
  }

  async function toggleAmbientField() {
    const previous = settings.fieldEnabled;
    settings.fieldEnabled = !settings.fieldEnabled;
    try { await queueSettingsWrite(); }
    catch (error) {
      settings.fieldEnabled = previous;
      showShellNotice(`Les préférences n’ont pas pu être enregistrées : ${error.message}`);
      return;
    }
    trayMenu();
    syncViews();
    if (settings.fieldEnabled) startAmbientHost(); else stopAmbientHost();
  }

  function createTray() {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "../assets/tray.png")));
    tray.setToolTip("DumbFuckCockpit Widget · Ctrl+Alt+Espace");
    tray.on("double-click", openPanel);
    trayMenu();
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
        showShellNotice("Le fichier de tâches ne peut pas être lu. DumbFuckCockpit le conserve sans l’écraser.");
        tasks = [];
      }
    }
    try { settings = cleanSettings(await readJson(settingsPath, settings)); }
    catch (error) { showShellNotice(`Les préférences n’ont pas pu être lues : ${error.message}`); }
    app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
    await configureIpc();
    createTray();
    if (settings.fieldEnabled) startAmbientHost(); else setAmbientStatus("hidden", "Widget transparent désactivé dans les préférences.");
    if (!globalShortcut.register("Control+Alt+Space", openPanel)) showShellNotice("Le raccourci Ctrl+Alt+Espace est déjà utilisé par une autre application.");
    globalShortcut.register("Control+Alt+Shift+Space", requestAmbientRebuild);
    app.on("activate", openPanel);
    appReady = true;
    if (secondInstancePending) openPanel();
    else openPanel(true);
  });

  app.on("before-quit", () => {
    quitting = true;
    if (ambientRestartTimer) clearTimeout(ambientRestartTimer);
    if (ambientProcess && ambientProcess.connected) {
      try { ambientProcess.send({ type: "shutdown" }); ambientProcess.disconnect(); }
      catch (_) { ambientProcess.kill(); }
    }
  });
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

