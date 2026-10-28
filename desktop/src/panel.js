"use strict";

(() => {
  const categories = [
    ["tat", "Boutique", "#fa759e", ["tatouage", "tatouages", "studio de tatouage", "tattoo"]],
    ["ate", "Atelier 3D", "#9bd779", ["3d", "impression 3d", "imprimante 3d"]],
    ["dro", "Studio drone", "#58c8dc", ["drone", "video drone", "videos drone"]],
    ["gar", "Garage trottinette", "#e9ae62", ["trottinette", "scooter", "garage scooter"]],
    ["lab", "Labo code", "#aa9df2", ["code", "programmation", "codage", "developpement"]],
    ["ban", "Banque", "#e9d274", ["finance", "finances", "revenus", "argent"]],
    ["cor", "Corps", "#6ed8c5", ["sante", "santé"]],
    ["mai", "Maison connectée", "#ef9d69", ["maison", "domotique"]],
    ["cry", "Crypto", "#d8c76a", ["cryptomonnaie", "cryptomonnaies"]],
    ["vr", "VR et AR", "#c0a0eb", ["vr", "ar", "realite virtuelle", "realite augmentee"]],
    ["arc", "Arcade", "#eb7985", ["game boy", "jeux video"]],
    ["soc", "Contenu et réseaux", "#74bde3", ["reseaux sociaux", "contenu", "reseaux", "social"]],
    ["app", "Design visuel", "#dc87be", ["design", "apparence", "interface", "esthetique"]]
  ];
  const durations = [5, 15, 30, 60, 90];
  const ignoredHeadings = new Set(["tache", "taches", "liste", "liste de taches", "a faire", "todo", "to do", "priorites", "objectifs", "tasks", "notes", "projets"]);
  const byId = (id) => document.getElementById(id);
  const state = { tasks: [], filter: "all", category: "", expanded: new Set(), pending: [], writeBlocked: false, settings: { side: "right", opacity: 0.82, motion: "measured", startWithWindows: false }, toastTimer: 0 };

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function categoryFrom(label) {
    const wanted = normalize(label);
    const found = categories.find(([id, name, color, aliases]) => normalize(name) === wanted || aliases.some((alias) => normalize(alias) === wanted));
    return found ? found[0] : null;
  }

  function categoryLabel(id) {
    const category = categories.find((entry) => entry[0] === id);
    return category ? category[1] : "À trier";
  }

  function createTask(data) {
    return {
      id: data.id && /^[a-zA-Z0-9_-]{1,80}$/.test(String(data.id)) ? String(data.id) : crypto.randomUUID(),
      title: String(data.title || "").trim().replace(/\s+/g, " ").slice(0, 180),
      category: categories.some((entry) => entry[0] === data.category) ? data.category : null,
      status: ["inbox", "todo", "doing", "done", "archived"].includes(data.status) ? data.status : (data.category ? "todo" : "inbox"),
      minutes: durations.includes(Number(data.minutes)) ? Number(data.minutes) : 15,
      priority: [1, 2, 3].includes(Number(data.priority)) ? Number(data.priority) : 2,
      doneWhen: String(data.doneWhen || "").trim().slice(0, 300),
      source: String(data.source || "personnelle").slice(0, 30)
    };
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function toast(message) {
    const element = byId("toast");
    element.textContent = message;
    element.classList.add("visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => element.classList.remove("visible"), 2800);
  }

  async function save() {
    try {
      await window.qgDesktop.saveTasks(state.tasks);
      render();
      return true;
    } catch (error) {
      toast(`Sauvegarde impossible : ${error.message}`);
      return false;
    }
  }

  function activeTasks() { return state.tasks.filter((task) => !["done", "archived"].includes(task.status)); }

  function renderSummary() {
    const active = activeTasks();
    const done = state.tasks.filter((task) => task.status === "done").length;
    const inbox = active.filter((task) => !task.category || task.status === "inbox").length;
    const doing = active.filter((task) => task.status === "doing").length;
    byId("countActive").textContent = String(active.length);
    byId("countDoing").textContent = String(doing);
    byId("countInbox").textContent = String(inbox);
    byId("countDone").textContent = String(done);
    byId("focusOpen").textContent = String(active.length);
    byId("focusPercent").textContent = String(state.tasks.length ? Math.round(done * 100 / state.tasks.length) : 0);
    byId("taskCount").textContent = `${active.length} TÂCHE${active.length === 1 ? "" : "S"}`;
    if (state.writeBlocked) {
      byId("focusHeading").textContent = "Les données locales sont protégées.";
      byId("focusSub").textContent = "Le fichier existant ne sera pas remplacé tant qu’il ne peut pas être relu.";
      return;
    }
    if (!active.length) {
      byId("focusHeading").textContent = "Votre prochain geste commence ici.";
      byId("focusSub").textContent = state.tasks.length ? "Votre file est terminée. Choisissez la prochaine priorité." : "Importez votre liste pour faire émerger le prochain pas.";
      return;
    }
    const next = active.slice().sort(sortTasks)[0];
    byId("focusHeading").textContent = next.title;
    byId("focusSub").textContent = `${categoryLabel(next.category)} · ${next.minutes} min · ${next.status === "doing" ? "déjà en cours" : next.status === "inbox" ? "à classer" : "prochain geste"}`;
  }

  function sortTasks(a, b) {
    const statusOrder = { doing: 0, todo: 1, inbox: 2, done: 3, archived: 4 };
    return (statusOrder[a.status] - statusOrder[b.status]) || (b.priority - a.priority) || a.title.localeCompare(b.title, "fr");
  }

  function renderCategories() {
    const rail = byId("categoryRail");
    rail.replaceChildren();
    const counts = new Map(categories.map(([id]) => [id, activeTasks().filter((task) => task.category === id).length]));
    const all = node("button", `category-chip${state.category ? "" : " active"}`, "Tous les univers");
    all.type = "button"; all.addEventListener("click", () => { state.category = ""; render(); }); rail.append(all);
    for (const [id, label] of categories) {
      if (!counts.get(id)) continue;
      const chip = node("button", `category-chip${state.category === id ? " active" : ""}`);
      chip.type = "button"; chip.style.setProperty("--category-color", categories.find((entry) => entry[0] === id)[2]);
      chip.append(document.createTextNode(label));
      const count = node("span", "count", String(counts.get(id))); chip.append(count);
      chip.addEventListener("click", () => { state.category = state.category === id ? "" : id; render(); }); rail.append(chip);
    }
  }

  function taskMatches(task) {
    if (state.filter === "doing" && task.status !== "doing") return false;
    if (state.filter === "inbox" && task.category && task.status !== "inbox") return false;
    if (state.category && task.category !== state.category) return false;
    return state.filter === "done" ? task.status === "done" : !["done", "archived"].includes(task.status);
  }

  function createSelect(options, value, label) {
    const select = document.createElement("select"); select.setAttribute("aria-label", label);
    for (const [optionValue, optionLabel] of options) {
      const option = document.createElement("option"); option.value = optionValue; option.textContent = optionLabel;
      if (optionValue === value) option.selected = true;
      select.append(option);
    }
    return select;
  }

  function renderTask(task) {
    const card = node("article", `task-card${task.status === "doing" ? " is-doing" : ""}${task.status === "done" ? " is-done" : ""}`);
    card.dataset.taskId = task.id;
    const line = node("div", "task-line");
    const complete = node("button", "complete", task.status === "done" ? "✓" : "");
    complete.type = "button"; complete.setAttribute("aria-label", task.status === "done" ? "Rouvrir la tâche" : "Marquer comme terminée");
    complete.addEventListener("click", async () => {
      task.status = task.status === "done" ? (task.category ? "todo" : "inbox") : "done";
      if (await save()) toast(task.status === "done" ? "Étape terminée et conservée." : "Tâche rouverte.");
    });
    const content = node("div", "task-content");
    const title = node("button", "task-title", task.title); title.type = "button"; title.addEventListener("click", () => toggleEdit(task.id));
    const meta = node("div", "task-meta");
    const categoryColor = categories.find((entry) => entry[0] === task.category)?.[2] || "#a6b8c1";
    const category = node("span", "task-category", categoryLabel(task.category)); category.style.setProperty("--category-color", categoryColor);
    const priority = node("span", "task-priority", ["", "P1", "P2", "P3"][task.priority]);
    const estimate = node("span", "task-estimate", task.minutes < 60 ? `${task.minutes} MIN` : `${task.minutes / 60} H`);
    meta.append(category, priority, estimate); content.append(title, meta);
    const controls = node("div", "task-controls");
    const status = node("button", "status-button", task.status === "doing" ? "PAUSE" : task.status === "inbox" ? "CLASSER" : "LANCER");
    status.type = "button"; status.title = task.status === "doing" ? "Remettre dans À faire" : "Passer en cours";
    status.addEventListener("click", async () => { task.status = task.status === "doing" ? (task.category ? "todo" : "inbox") : "doing"; await save(); });
    const edit = node("button", "edit-button", state.expanded.has(task.id) ? "−" : "···"); edit.type = "button";
    edit.setAttribute("aria-label", "Modifier les détails"); edit.addEventListener("click", () => toggleEdit(task.id));
    controls.append(status, edit); line.append(complete, content, controls); card.append(line);
    if (state.expanded.has(task.id)) card.append(renderEditor(task));
    return card;
  }

  function toggleEdit(id) {
    if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
    render();
  }

  function renderEditor(task) {
    const editor = node("div", "edit-fields");
    const categoriesList = [["", "À trier"], ...categories.map(([id, label]) => [id, label])];
    const category = createSelect(categoriesList, task.category || "", "Univers de la tâche");
    const minutes = createSelect(durations.map((value) => [String(value), value < 60 ? `${value} min` : `${value / 60} h`]), String(task.minutes), "Durée estimée");
    const priority = createSelect([["1", "P1 · légère"], ["2", "P2 · normale"], ["3", "P3 · prioritaire"]], String(task.priority), "Priorité");
    const doneWhen = document.createElement("textarea"); doneWhen.maxLength = 300; doneWhen.placeholder = "Concrètement, comment saura-t-on que c’est fini ?"; doneWhen.value = task.doneWhen || ""; doneWhen.setAttribute("aria-label", "Définition de terminé");
    const actions = node("div", "edit-actions"); const saveButton = node("button", "tiny-save", "Enregistrer les critères"); saveButton.type = "button";
    saveButton.addEventListener("click", async () => {
      task.category = category.value || null; task.minutes = Number(minutes.value); task.priority = Number(priority.value);
      task.doneWhen = doneWhen.value.trim();
      if (task.category && task.status === "inbox") task.status = "todo";
      if (await save()) { state.expanded.delete(task.id); toast("Critères enregistrés."); }
    });
    actions.append(saveButton); editor.append(category, minutes, priority, doneWhen, actions); return editor;
  }

  function render() {
    renderSummary(); renderCategories();
    byId("newTitle").disabled = state.writeBlocked;
    byId("newCategory").disabled = state.writeBlocked;
    byId("importOpen").disabled = state.writeBlocked;
    byId("exportOpen").disabled = state.writeBlocked;
    const list = byId("taskList"); list.replaceChildren();
    const activeFilter = document.querySelector(".view.active")?.dataset.filter || "all";
    byId("listHeading").textContent = state.category ? categoryLabel(state.category) : activeFilter === "doing" ? "En cours" : activeFilter === "inbox" ? "À clarifier" : activeFilter === "done" ? "Terminées" : "À faire maintenant";
    const visible = state.tasks.filter(taskMatches).sort(sortTasks);
    if (!visible.length) {
      const empty = node("div", "empty-state"); const copy = node("div");
      copy.append(node("span", "empty-symbol", state.filter === "inbox" ? "⌁" : "◌"));
      copy.append(node("strong", "", state.filter === "inbox" ? "La file reste nette." : state.tasks.length ? "Rien à afficher dans cette vue." : "Aucune tâche à recopier.") );
      copy.append(node("p", "", state.writeBlocked ? "Aucune modification ne sera enregistrée pour éviter d’écraser la sauvegarde endommagée." : state.tasks.length ? "Ajoutez une tâche ou choisissez un autre univers." : "Importez votre fichier .txt/.md ou la sauvegarde JSON du cockpit. Les tâches incertaines restent à trier."));
      empty.append(copy); list.append(empty); return;
    }
    for (const task of visible) list.append(renderTask(task));
  }

  function setFilter(filter) {
    state.filter = filter; state.category = "";
    document.querySelectorAll(".view").forEach((button) => button.classList.toggle("active", button.dataset.filter === filter));
    render();
  }

  function parseText(text) {
    let section = null;
    const result = [];
    const lines = String(text || "").split(/\r?\n/);
    for (const raw of lines) {
      let line = raw.trim();
      if (!line || /^[-=_*]{3,}$/.test(line)) continue;
      const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
      if (heading) {
        const label = heading[1].replace(/[:：]\s*$/, "").trim();
        section = categoryFrom(label);
        if (!section && !ignoredHeadings.has(normalize(label))) result.push(createTask({ title: label, category: null, status: "inbox", source: "txt · titre à vérifier" }));
        continue;
      }
      const bareHeading = line.replace(/[:：]\s*$/, "");
      if (ignoredHeadings.has(normalize(bareHeading))) { section = null; continue; }
      const matchedCategory = categoryFrom(bareHeading);
      if (matchedCategory) { section = matchedCategory; continue; }
      let done = false;
      const check = line.match(/^(?:[-*+•]\s*)?\[([ xX])\]\s*(.*)$/);
      if (check) { done = /x/i.test(check[1]); line = check[2]; }
      else {
        const checkmark = line.match(/^([☐☑✅])\s*(.*)$/);
        if (checkmark) { done = checkmark[1] !== "☐"; line = checkmark[2]; }
      }
      line = line.replace(/^(?:[-*+•]|\d+[.)])\s*/, "");
      const explicitTag = line.match(/^\[([^\]]+)\]\s*(.+)$/);
      let taskCategory = section;
      if (explicitTag) {
        const tagCategory = categoryFrom(explicitTag[1]);
        if (tagCategory) { taskCategory = tagCategory; line = explicitTag[2]; }
      }
      const title = line.trim().replace(/\s+/g, " ").slice(0, 180);
      if (title) result.push(createTask({ title, category: taskCategory, status: done ? "done" : taskCategory ? "todo" : "inbox", source: "txt" }));
    }
    return result.slice(0, 500);
  }

  function parseFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension === "json") {
      const data = JSON.parse(file.text);
      if (!data || !["qg-personal-tasks", "qg-cockpit-tasks"].includes(data.format) || !Array.isArray(data.tasks)) {
        throw new Error("Ce fichier n’est pas une sauvegarde QG reconnue. Aucune donnée n’a été modifiée.");
      }
      return data.tasks.slice(0, 500).map((task) => createTask({ ...task, source: "sauvegarde QG" })).filter((task) => task.title);
    }
    return parseText(file.text);
  }

  function showImportPreview(items, fileName) {
    state.pending = items;
    const preview = byId("importPreview"), rows = byId("previewRows");
    rows.replaceChildren();
    const existing = new Set(state.tasks.map((task) => `${normalize(task.title)}::${task.category || ""}`));
    const newOnes = items.filter((task) => !existing.has(`${normalize(task.title)}::${task.category || ""}`));
    const duplicates = items.length - newOnes.length;
    byId("previewSummary").textContent = `${items.length} élément${items.length === 1 ? "" : "s"} repéré${items.length === 1 ? "" : "s"} dans « ${fileName} » · ${newOnes.length} à ajouter · ${duplicates} doublon${duplicates === 1 ? "" : "s"} ignoré${duplicates === 1 ? "" : "s"}`;
    for (const task of items.slice(0, 14)) {
      const row = node("li"); row.append(document.createTextNode(`${task.title} — `), node("em", "", categoryLabel(task.category))); rows.append(row);
    }
    if (items.length > 14) rows.append(node("li", "", `… et ${items.length - 14} autre(s)`));
    byId("previewNotice").textContent = "Les en-têtes reconnus sont classés. Un en-tête inconnu devient une tâche à vérifier, et ses lignes restent « À trier ». Aucune tâche existante n’est remplacée.";
    byId("importConfirm").disabled = newOnes.length === 0;
    byId("importConfirm").textContent = newOnes.length ? `Ajouter ${newOnes.length} tâche${newOnes.length === 1 ? "" : "s"}` : "Aucune nouvelle tâche";
    preview.hidden = false;
  }

  function showSettings(open) {
    byId("settingsPanel").hidden = !open;
    if (open) {
      byId("settingSide").value = state.settings.side || "right";
      byId("settingOpacity").value = String(Math.round((state.settings.opacity || 0.82) * 100));
      byId("settingMotion").value = state.settings.motion || "measured";
      byId("settingStartup").checked = Boolean(state.settings.startWithWindows);
    }
  }

  async function persistSettings() {
    state.settings = await window.qgDesktop.saveSettings({
      side: byId("settingSide").value,
      opacity: Number(byId("settingOpacity").value) / 100,
      motion: byId("settingMotion").value,
      startWithWindows: byId("settingStartup").checked
    });
    toast("Préférences du bureau enregistrées.");
  }

  function initialize() {
    const categorySelect = byId("newCategory");
    for (const [id, label] of categories) { const option = node("option", "", label); option.value = id; categorySelect.append(option); }
    document.querySelectorAll(".view").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.filter)));
    byId("panelClose").addEventListener("click", () => window.qgDesktop.closePanel());
    byId("settingsOpen").addEventListener("click", () => showSettings(true));
    byId("settingsClose").addEventListener("click", () => showSettings(false));
    byId("importOpen").addEventListener("click", () => { byId("importDialog").showModal(); byId("importPreview").hidden = true; state.pending = []; });
    byId("chooseFile").addEventListener("click", async () => {
      try {
        const file = await window.qgDesktop.chooseImport();
        if (!file) return;
        const items = parseFile(file);
        showImportPreview(items, file.name);
      } catch (error) { toast(error.message || "Impossible de lire ce fichier."); }
    });
    byId("importConfirm").addEventListener("click", async () => {
      const existing = new Set(state.tasks.map((task) => `${normalize(task.title)}::${task.category || ""}`));
      const additions = state.pending.filter((task) => !existing.has(`${normalize(task.title)}::${task.category || ""}`));
      if (!additions.length) return;
      if (state.tasks.length + additions.length > 500) { toast("La liste atteindrait la limite de 500 tâches."); return; }
      state.tasks.push(...additions); state.pending = [];
      byId("importDialog").close();
      if (await save()) toast(`${additions.length} tâche${additions.length === 1 ? "" : "s"} ajoutée${additions.length === 1 ? "" : "s"}.`);
    });
    byId("exportOpen").addEventListener("click", async () => {
      try {
        const result = await window.qgDesktop.exportTasks(state.tasks);
        if (result.ok) toast(`Copie « ${result.fileName} » créée. Elle peut être réimportée dans le cockpit web.`);
      } catch (error) { toast(`Export impossible : ${error.message}`); }
    });
    byId("addForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const title = byId("newTitle").value.trim();
      if (!title || state.tasks.length >= 500) { toast(state.tasks.length >= 500 ? "La liste est limitée à 500 tâches." : "Ajoutez un titre avant d’enregistrer."); return; }
      const category = categorySelect.value || null;
      state.tasks.unshift(createTask({ title, category, status: category ? "todo" : "inbox", source: "personnelle" }));
      if (await save()) { byId("newTitle").value = ""; byId("newTitle").focus(); }
    });
    byId("openWeb").addEventListener("click", () => window.qgDesktop.openSite());
    ["settingSide", "settingOpacity", "settingMotion", "settingStartup"].forEach((id) => byId(id).addEventListener("change", persistSettings));
    byId("importDialog").addEventListener("close", () => { state.pending = []; });
    window.addEventListener("keydown", (event) => { if (event.key === "Escape" && !byId("importDialog").open && !byId("settingsPanel").hidden) showSettings(false); });
    window.qgDesktop.onSnapshot((snapshot) => { state.tasks = (snapshot.tasks || []).map(createTask); state.writeBlocked = Boolean(snapshot.blocked); render(); });
    window.qgDesktop.getTasks().then((snapshot) => { state.tasks = (snapshot.tasks || []).map(createTask); state.writeBlocked = Boolean(snapshot.blocked); render(); if (state.writeBlocked) toast("La sauvegarde reste intacte; QG Desktop refuse de la remplacer."); });
    window.qgDesktop.getSettings().then((settings) => { state.settings = { ...state.settings, ...settings }; });
    render();
  }

  initialize();
})();
