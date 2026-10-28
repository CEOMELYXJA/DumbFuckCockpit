(function () {
  "use strict";
  // This panel owns its UI and storage. It never replaces the cockpit's renderer.
  const STORAGE_KEY = "qg-personal-tasks-v2";
  const LEGACY_KEY = "qg-v3";
  const LIMIT = 500;
  const CATEGORIES = [
    ["tat", "Boutique", "🖋️", ["tatouage", "tatouages", "studio de tatouage", "tattoo"]],
    ["ate", "Atelier 3D", "🖨️", ["3d", "impression 3d", "imprimante 3d"]],
    ["dro", "Studio drone", "🚁", ["drone", "video drone", "videos drone"]],
    ["gar", "Garage trottinette", "🛴", ["trottinette", "scooter", "garage scooter"]],
    ["lab", "Labo code", "💻", ["code", "programmation", "codage", "developpement"]],
    ["ban", "Banque", "💰", ["finance", "finances", "revenus", "argent"]],
    ["cor", "Corps", "🔋", ["sante", "santé"]],
    ["mai", "Maison connectée", "🏠", ["maison", "domotique"]],
    ["cry", "Crypto", "🪙", ["cryptomonnaie", "cryptomonnaies"]],
    ["vr", "VR et AR", "🥽", ["vr", "ar", "realite virtuelle", "realite augmentee"]],
    ["arc", "Arcade", "🕹️", ["game boy", "jeux video"]],
    ["soc", "Contenu et réseaux", "📣", ["reseaux sociaux", "contenu", "reseaux", "social"]],
    ["app", "Design visuel", "🎨", ["design", "apparence", "interface", "esthetique"]]
  ];
  const STATUSES = { inbox: "À trier", todo: "À faire", doing: "En cours", done: "Terminée", archived: "Archivée" };
  const DURATIONS = [5, 15, 30, 60, 90];

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function makeId() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : "qg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }
  function validCategory(id) { return CATEGORIES.some(function (item) { return item[0] === id; }); }
  function categoryName(id) {
    const item = CATEGORIES.find(function (entry) { return entry[0] === id; });
    return item ? item[2] + " " + item[1] : "À trier";
  }
  function categoryFrom(label) {
    const wanted = normalizeText(label);
    const item = CATEGORIES.find(function (entry) {
      return normalizeText(entry[1]) === wanted || entry[3].some(function (alias) { return normalizeText(alias) === wanted; });
    });
    return item ? item[0] : null;
  }
  function cleanTask(task) {
    task = task || {};
    const category = validCategory(task.category) ? task.category : null;
    const status = Object.prototype.hasOwnProperty.call(STATUSES, task.status) ? task.status : (category ? "todo" : "inbox");
    return {
      id: /^[a-zA-Z0-9_-]{1,80}$/.test(String(task.id || "")) ? String(task.id) : makeId(),
      title: String(task.title || "").trim().slice(0, 180),
      category: category,
      status: status,
      minutes: DURATIONS.indexOf(+task.minutes) >= 0 ? +task.minutes : 15,
      priority: [1, 2, 3].indexOf(+task.priority) >= 0 ? +task.priority : 2,
      doneWhen: String(task.doneWhen || "").slice(0, 300),
      source: String(task.source || "personnelle").slice(0, 30)
    };
  }
  function loadTasks() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (current && Array.isArray(current.tasks)) return current.tasks.map(cleanTask).filter(function (task) { return task.title; });
    } catch (error) {}
    // Copy tasks from the previous trial without changing or deleting the cockpit's saved state.
    try {
      const previous = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      if (previous && Array.isArray(previous.userTasks)) return previous.userTasks.map(cleanTask).filter(function (task) { return task.title; });
    } catch (error) {}
    return [];
  }
  function storeTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ format: "qg-personal-tasks", version: 2, tasks: tasks }));
      return true;
    } catch (error) { return false; }
  }

  const root = document.createElement("div");
  root.id = "qgToolsRoot";
  root.innerHTML =
    '<div id="qgToolbar" aria-label="Outils du cockpit">' +
      '<button id="qgOpenTasks" type="button" aria-haspopup="dialog" aria-controls="qgTaskManager">☷ Mes tâches</button>' +
      '<button id="qgInstallApp" type="button" aria-describedby="qgInstallHint">⇩ Installer</button>' +
      '<div id="qgInstallHint" role="status" hidden><span></span><button id="qgInstallHintClose" type="button" aria-label="Fermer le conseil">✕</button></div>' +
    '</div>' +
    '<div id="qgTaskShade" hidden>' +
      '<section id="qgTaskManager" role="dialog" aria-modal="true" aria-labelledby="qgTaskTitle" tabindex="-1">' +
        '<header class="qg-head"><div><p class="qg-kicker">QG · ORGANISATION PERSONNELLE</p><h2 id="qgTaskTitle">Mes tâches</h2>' +
          '<p class="qg-intro">Importez votre liste en une fois. Chaque tâche reste modifiable et rien ne sera classé au hasard.</p></div>' +
          '<button id="qgCloseTasks" type="button" aria-label="Fermer Mes tâches">✕</button></header>' +
        '<form id="qgTaskAddForm" class="qg-add">' +
          '<label class="qg-grow">Nouvelle tâche<input id="qgTaskNewTitle" maxlength="180" placeholder="Ex. Confirmer le rendez-vous avec…" required></label>' +
          '<label>Univers<select id="qgTaskNewCategory"></select></label>' +
          '<label>Durée<select id="qgTaskNewMinutes"><option value="5">5 min</option><option value="15" selected>15 min</option><option value="30">30 min</option><option value="60">1 h</option><option value="90">1 h 30</option></select></label>' +
          '<button class="qg-primary" type="submit">＋ Ajouter</button><p class="qg-hint">Classement facultatif : ce qui est incertain reste « À trier ».</p></form>' +
        '<details class="qg-import"><summary>Importer sans tout retaper : .txt, .md ou sauvegarde .json</summary>' +
          '<p>Prévisualisez les lignes avant de les ajouter. Les tâches existantes ne seront jamais remplacées.</p>' +
          '<label class="qg-file-label" for="qgTaskFile">Choisir un fichier texte ou une sauvegarde</label>' +
          '<input id="qgTaskFile" type="file" accept=".txt,.md,.markdown,.json,text/plain,application/json">' +
          '<label for="qgTaskPaste">Ou coller le texte ici</label>' +
          '<textarea id="qgTaskPaste" rows="5" placeholder="## Tatouage&#10;- Répondre à la cliente pour confirmer la date&#10;&#10;## Atelier 3D&#10;- Photographier le support terminé"></textarea>' +
          '<div class="qg-actions"><button id="qgPreviewImport" type="button">Prévisualiser</button><button id="qgExportTasks" type="button">Télécharger une copie (.json)</button></div>' +
          '<div id="qgImportPreview" class="qg-preview" hidden aria-live="polite"><h3>Aperçu avant ajout</h3><p id="qgImportSummary"></p><ul id="qgImportRows"></ul>' +
            '<div class="qg-actions"><button id="qgApplyImport" type="button" class="qg-primary">Ajouter ces tâches</button><button id="qgCancelImport" type="button">Annuler</button></div></div>' +
          '<p id="qgImportNotice" class="qg-notice" role="status" aria-live="polite"></p></details>' +
        '<section class="qg-list-section" aria-labelledby="qgListHeading">' +
          '<div class="qg-list-head"><div><h3 id="qgListHeading">Votre liste</h3><p id="qgTaskCounts" class="qg-hint"></p></div></div>' +
          '<div class="qg-tools"><label class="qg-grow">Rechercher<input id="qgTaskSearch" type="search" placeholder="Nom, résultat attendu…"></label>' +
            '<label>Afficher<select id="qgTaskFilter"><option value="active">À trier, à faire et en cours</option><option value="inbox">À trier</option><option value="done">Terminées</option><option value="archived">Archivées</option><option value="all">Tout</option></select></label></div>' +
          '<p class="qg-local-note">Les tâches sont enregistrées dans ce navigateur. La progression du cockpit reste séparée. Exportez une copie pour la garder.</p>' +
          '<div id="qgTaskList" class="qg-task-list"></div></section><p id="qgFeedback" class="qg-feedback" role="status" aria-live="polite"></p></section></div>';
  document.body.appendChild(root);

  const byId = function (id) { return document.getElementById(id); };
  const shade = byId("qgTaskShade");
  const list = byId("qgTaskList");
  const legacySaved = (function () {
    if (localStorage.getItem(STORAGE_KEY)) return false;
    try {
      const data = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      return !!(data && Array.isArray(data.userTasks) && data.userTasks.length);
    } catch (error) { return false; }
  })();
  let tasks = loadTasks();
  let pending = [];
  let previousFocus = null;
  if (legacySaved && tasks.length) storeTasks();

  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function fieldLabel(text, control) {
    const label = makeElement("label", "", text);
    label.appendChild(control);
    return label;
  }
  function option(value, label, selected) {
    const node = makeElement("option", "", label);
    node.value = value;
    node.selected = value === selected;
    return node;
  }
  function selectControl(items, selected, key, taskId) {
    const control = document.createElement("select");
    if (key) { control.dataset.taskField = key; control.dataset.taskId = taskId; }
    items.forEach(function (item) { control.appendChild(option(item[0], item[1], String(selected))); });
    return control;
  }
  function renderList() {
    const filter = byId("qgTaskFilter").value;
    const query = normalizeText(byId("qgTaskSearch").value);
    const order = { inbox: 0, todo: 1, doing: 2, done: 3, archived: 4 };
    const items = tasks.slice().sort(function (a, b) {
      return order[a.status] - order[b.status] || a.priority - b.priority || a.title.localeCompare(b.title, "fr");
    }).filter(function (task) {
      const matches = filter === "all" || filter === "active" && (task.status === "inbox" || task.status === "todo" || task.status === "doing") || filter === task.status;
      const searchable = normalizeText(task.title + " " + task.doneWhen + " " + categoryName(task.category));
      return matches && (!query || searchable.indexOf(query) >= 0);
    });
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(makeElement("p", "qg-empty", tasks.length ? "Aucune tâche ne correspond à ce filtre." : "Votre liste est vide. Importez votre fichier ou ajoutez une tâche; aucune donnée du cockpit n’a été modifiée."));
      return;
    }
    items.forEach(function (task) {
      const card = makeElement("article", "qg-task-card");
      const fields = makeElement("div", "qg-task-fields");
      const title = document.createElement("input");
      title.maxLength = 180; title.value = task.title;
      title.dataset.taskField = "title"; title.dataset.taskId = task.id;
      fields.appendChild(fieldLabel("Action", title));
      const categoryOptions = [["", "À trier"]].concat(CATEGORIES.map(function (entry) { return [entry[0], entry[2] + " " + entry[1]]; }));
      fields.appendChild(fieldLabel("Univers", selectControl(categoryOptions, task.category || "", "category", task.id)));
      fields.appendChild(fieldLabel("État", selectControl(Object.keys(STATUSES).map(function (key) { return [key, STATUSES[key]]; }), task.status, "status", task.id)));
      fields.appendChild(fieldLabel("Durée", selectControl(DURATIONS.map(function (minutes) { return [String(minutes), minutes < 60 ? minutes + " min" : (minutes / 60) + " h"]; }), String(task.minutes), "minutes", task.id)));
      fields.appendChild(fieldLabel("Priorité", selectControl([["1", "Haute"], ["2", "Normale"], ["3", "Peut attendre"]], String(task.priority), "priority", task.id)));
      card.appendChild(fields);

      const doneWhen = document.createElement("textarea");
      doneWhen.maxLength = 300; doneWhen.placeholder = "Je saurai que c’est terminé quand…"; doneWhen.value = task.doneWhen;
      doneWhen.dataset.taskField = "doneWhen"; doneWhen.dataset.taskId = task.id;
      card.appendChild(fieldLabel("Résultat clair (facultatif)", doneWhen));
      const actions = makeElement("div", "qg-task-actions");
      actions.appendChild(makeElement("span", "qg-task-origin", categoryName(task.category) + " · " + STATUSES[task.status]));
      const archive = makeElement("button", "", task.status === "archived" ? "Réactiver" : "Archiver");
      archive.type = "button"; archive.dataset.taskAction = task.status === "archived" ? "restore" : "archive"; archive.dataset.taskId = task.id;
      actions.appendChild(archive); card.appendChild(actions); list.appendChild(card);
    });
  }
  function render() {
    const active = tasks.filter(function (task) { return task.status !== "archived"; });
    const inbox = tasks.filter(function (task) { return task.status === "inbox"; }).length;
    const doing = tasks.filter(function (task) { return task.status === "todo" || task.status === "doing"; }).length;
    const done = tasks.filter(function (task) { return task.status === "done"; }).length;
    byId("qgTaskCounts").textContent = active.length + " tâche" + (active.length === 1 ? "" : "s") +
      " · " + doing + " à faire/en cours · " + inbox + " à trier · " + done + " terminée" + (done === 1 ? "" : "s");
    renderList();
  }
  function openManager() {
    previousFocus = document.activeElement; shade.hidden = false; render(); byId("qgTaskNewTitle").focus();
  }
  function closeManager() {
    shade.hidden = true;
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }
  function feedback(message) { byId("qgFeedback").textContent = message; }
  function makeTask(data) {
    return cleanTask({
      id: makeId(), title: data.title, category: data.category,
      status: data.status || (data.category ? "todo" : "inbox"),
      minutes: data.minutes || 15, priority: data.priority || 2,
      doneWhen: data.doneWhen || "", source: data.source || "personnelle"
    });
  }
  function parseText(text) {
    let section = null;
    const result = [];
    const ignored = ["tache", "taches", "liste", "liste de taches", "a faire", "todo", "to do", "priorites", "objectifs", "tasks"];
    String(text || "").split(/\r?\n/).forEach(function (raw) {
      let line = raw.trim();
      if (!line || /^[-=_*]{3,}$/.test(line)) return;
      const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
      if (heading) { section = categoryFrom(heading[1].replace(/[:：]\s*$/, "")); return; }
      const bareHeading = line.replace(/[:：]\s*$/, "");
      if (ignored.indexOf(normalizeText(bareHeading)) >= 0) { section = null; return; }
      const category = categoryFrom(bareHeading);
      if (category) { section = category; return; }
      let done = false;
      const check = line.match(/^(?:[-*+•]\s*)?\[([ xX])\]\s*(.*)$/);
      if (check) { done = /x/i.test(check[1]); line = check[2]; }
      else {
        const checkmark = line.match(/^([☐☑✅])\s*(.*)$/);
        if (checkmark) { done = checkmark[1] !== "☐"; line = checkmark[2]; }
      }
      line = line.replace(/^(?:[-*+•]|\d+[.)])\s*/, "");
      const tag = line.match(/^\[([^\]]+)\]\s*(.+)$/);
      let taskCategory = section;
      if (tag) {
        const taggedCategory = categoryFrom(tag[1]);
        if (taggedCategory) { taskCategory = taggedCategory; line = tag[2]; }
      }
      line = line.trim().replace(/\s+/g, " ").slice(0, 180);
      if (line) result.push(makeTask({ title: line, category: taskCategory, status: done ? "done" : taskCategory ? "todo" : "inbox", source: "txt" }));
    });
    return result.slice(0, LIMIT);
  }
  function parseBackup(data) {
    if (!data || (data.format !== "qg-cockpit-tasks" && data.format !== "qg-personal-tasks") || !Array.isArray(data.tasks)) {
      throw new Error("Ce fichier n’est pas une sauvegarde de tâches QG reconnue.");
    }
    return data.tasks.slice(0, LIMIT).map(function (task) {
      const clean = cleanTask(task); clean.source = "sauvegarde"; return clean;
    }).filter(function (task) { return task.title; });
  }
  function showPreview(items, kind) {
    pending = items;
    const preview = byId("qgImportPreview"), rows = byId("qgImportRows");
    rows.replaceChildren();
    if (!items.length) { preview.hidden = true; byId("qgImportNotice").textContent = "Aucune tâche lisible trouvée. Vérifiez que chaque tâche occupe une ligne."; return; }
    const counts = {};
    items.forEach(function (task) { const name = categoryName(task.category); counts[name] = (counts[name] || 0) + 1; });
    byId("qgImportSummary").textContent = items.length + " tâche" + (items.length === 1 ? "" : "s") +
      " trouvée" + (items.length === 1 ? "" : "s") + " dans " + kind + " · " +
      Object.keys(counts).map(function (name) { return name + ": " + counts[name]; }).join(" · ");
    items.slice(0, 12).forEach(function (task) {
      const row = makeElement("li", "", task.title + " — ");
      row.appendChild(makeElement("em", "", categoryName(task.category))); rows.appendChild(row);
    });
    if (items.length > 12) rows.appendChild(makeElement("li", "", "… et " + (items.length - 12) + " autre(s)"));
    byId("qgApplyImport").textContent = "Ajouter " + items.length + " tâche" + (items.length === 1 ? "" : "s");
    preview.hidden = false;
    byId("qgImportNotice").textContent = "Vérifiez le classement avant l’ajout. « À trier » signifie qu’aucune catégorie n’a été devinée.";
  }
  function startImport() { showPreview(parseText(byId("qgTaskPaste").value), "texte"); }
  function addPending() {
    if (!pending.length) return;
    const seen = new Set(tasks.map(function (task) { return normalizeText(task.title); }));
    let added = 0, duplicates = 0;
    pending.forEach(function (task) {
      const key = normalizeText(task.title);
      if (!key || seen.has(key)) { duplicates++; return; }
      seen.add(key); tasks.push(cleanTask(task)); added++;
    });
    pending = []; byId("qgImportPreview").hidden = true;
    byId("qgImportNotice").textContent = added + " tâche" + (added === 1 ? "" : "s") + " ajoutée" +
      (added === 1 ? "" : "s") + (duplicates ? " · " + duplicates + " doublon(s) ignoré(s)" : "") +
      " · Aucune tâche existante n’a été remplacée.";
    if (!storeTasks()) feedback("Le navigateur n’a pas pu enregistrer les tâches. Téléchargez une copie JSON.");
    render();
  }
  function importFailure(message) {
    pending = []; byId("qgImportPreview").hidden = true; byId("qgImportNotice").textContent = message;
  }

  byId("qgTaskNewCategory").appendChild(option("", "À trier", ""));
  CATEGORIES.forEach(function (item) { byId("qgTaskNewCategory").appendChild(option(item[0], item[2] + " " + item[1], "")); });
  byId("qgOpenTasks").addEventListener("click", openManager);
  byId("qgCloseTasks").addEventListener("click", closeManager);
  shade.addEventListener("click", function (event) { if (event.target === shade) closeManager(); });
  byId("qgTaskManager").addEventListener("keydown", function (event) {
    if (event.key === "Escape") { closeManager(); return; }
    if (event.key !== "Tab") return;
    const focusable = Array.from(byId("qgTaskManager").querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary"))
      .filter(function (node) { return node.offsetParent !== null; });
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
  });
  byId("qgTaskAddForm").addEventListener("submit", function (event) {
    event.preventDefault();
    const title = byId("qgTaskNewTitle").value.trim();
    if (!title) return;
    tasks.unshift(makeTask({ title: title, category: byId("qgTaskNewCategory").value || null, minutes: +byId("qgTaskNewMinutes").value, source: "personnelle" }));
    byId("qgTaskNewTitle").value = "";
    if (!storeTasks()) feedback("Le navigateur n’a pas pu enregistrer les tâches. Téléchargez une copie JSON.");
    render(); feedback("Tâche ajoutée.");
  });
  byId("qgTaskFilter").addEventListener("change", renderList);
  byId("qgTaskSearch").addEventListener("input", renderList);
  list.addEventListener("change", function (event) {
    const field = event.target.closest("[data-task-field]");
    if (!field) return;
    const task = tasks.find(function (item) { return item.id === field.dataset.taskId; });
    if (!task) return;
    const key = field.dataset.taskField;
    if (key === "title") { const title = field.value.trim(); if (title) task.title = title.slice(0, 180); }
    else if (key === "category") { task.category = validCategory(field.value) ? field.value : null; if (task.category && task.status === "inbox") task.status = "todo"; }
    else if (key === "status" && Object.prototype.hasOwnProperty.call(STATUSES, field.value)) task.status = field.value;
    else if (key === "minutes" && DURATIONS.indexOf(+field.value) >= 0) task.minutes = +field.value;
    else if (key === "priority" && [1, 2, 3].indexOf(+field.value) >= 0) task.priority = +field.value;
    else if (key === "doneWhen") task.doneWhen = field.value.slice(0, 300);
    if (!storeTasks()) feedback("Le navigateur n’a pas pu enregistrer les tâches. Téléchargez une copie JSON.");
    render();
  });
  list.addEventListener("click", function (event) {
    const button = event.target.closest("[data-task-action]");
    if (!button) return;
    const task = tasks.find(function (item) { return item.id === button.dataset.taskId; });
    if (!task) return;
    task.status = button.dataset.taskAction === "archive" ? "archived" : "todo";
    storeTasks(); render();
  });
  byId("qgPreviewImport").addEventListener("click", startImport);
  byId("qgTaskFile").addEventListener("change", async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 1000000) { importFailure("Le fichier dépasse 1 Mo. Importez seulement la liste de tâches."); event.target.value = ""; return; }
    try {
      const content = await file.text();
      if (/\.json$/i.test(file.name)) showPreview(parseBackup(JSON.parse(content)), "sauvegarde JSON");
      else { byId("qgTaskPaste").value = content; startImport(); }
    } catch (error) { importFailure(error && error.message ? error.message : "Impossible de lire ce fichier."); }
    event.target.value = "";
  });
  byId("qgApplyImport").addEventListener("click", addPending);
  byId("qgCancelImport").addEventListener("click", function () {
    pending = []; byId("qgImportPreview").hidden = true; byId("qgImportNotice").textContent = "Import annulé; aucune tâche n’a été ajoutée.";
  });
  byId("qgExportTasks").addEventListener("click", function () {
    const data = { format: "qg-personal-tasks", version: 2, exportedAt: new Date().toISOString(), tasks: tasks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "qg-taches-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  byId("qgInstallHintClose").addEventListener("click", function () { byId("qgInstallHint").hidden = true; });
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", function (event) { event.preventDefault(); installPrompt = event; });
  byId("qgInstallApp").addEventListener("click", async function () {
    const hint = byId("qgInstallHint"), text = hint.querySelector("span");
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      text.textContent = "Le QG est déjà ouvert en mode application. Vous pouvez l’épingler depuis Windows.";
    } else if (installPrompt) {
      const prompt = installPrompt; installPrompt = null; await prompt.prompt();
      const choice = await prompt.userChoice;
      text.textContent = choice.outcome === "accepted" ? "Le QG est en cours d’installation." : "Installation annulée. Réessayez depuis le menu du navigateur.";
    } else {
      text.textContent = "Dans Microsoft Edge, ouvrez ⋯ > Applications > Installer ce site comme une application.";
    }
    hint.hidden = false;
  });
  window.addEventListener("appinstalled", function () {
    byId("qgInstallHint").querySelector("span").textContent = "Installation terminée. Vous pouvez lancer le QG depuis Windows.";
    byId("qgInstallHint").hidden = false;
  });

  const legacyImportCount = legacySaved ? tasks.length : 0;
  render();
  if (legacyImportCount) feedback(legacyImportCount + " ancienne(s) tâche(s) copiée(s). La sauvegarde originale reste intacte.");
})();
