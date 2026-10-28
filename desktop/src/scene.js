"use strict";

(() => {
  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  const TAU = Math.PI * 2;
  const nodes = [
    ["tat", "Boutique"], ["ate", "Atelier 3D"], ["dro", "Studio drone"], ["gar", "Garage trottinette"],
    ["lab", "Labo code"], ["ban", "Banque"], ["cor", "Corps"], ["mai", "Maison connectée"],
    ["cry", "Crypto"], ["vr", "VR et AR"], ["arc", "Arcade"], ["soc", "Contenu et réseaux"], ["app", "Design visuel"]
  ];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const state = { categories: [], tasks: [], settings: { side: "right", opacity: 0.82, motion: "measured" }, active: false, lastFrame: 0, start: performance.now() };
  let ratio = 1;
  let width = 0;
  let height = 0;

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function getLayout() {
    const scale = Math.min(1, width / 1120, height / 720);
    const zoneWidth = Math.min(890, width * 0.68) * Math.max(0.58, scale);
    const zoneHeight = Math.min(570, height * 0.76) * Math.max(0.58, scale);
    const left = state.settings.side === "left" ? 38 : Math.max(20, width - zoneWidth - 46);
    const top = Math.max(30, (height - zoneHeight) / 2);
    return { left, top, width: zoneWidth, height: zoneHeight, cx: left + zoneWidth * 0.55, cy: top + zoneHeight * 0.55, scale: Math.max(0.58, scale) };
  }

  function alpha(value) { return Math.max(0, Math.min(1, value * Number(state.settings.opacity || 0.82))); }

  function roundedPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  function drawFrame(now) {
    if (!state.active || document.hidden) { setTimeout(() => requestAnimationFrame(drawFrame), 1000); return; }
    const motion = reducedMotion.matches || state.settings.motion === "reduced" ? 0 : 1;
    const interval = motion ? 34 : 1000;
    if (now - state.lastFrame < interval) { requestAnimationFrame(drawFrame); return; }
    const elapsed = Math.max(0, Math.min(0.1, (now - state.lastFrame) / 1000 || 1 / 30));
    state.lastFrame = now;
    ctx.clearRect(0, 0, width, height);
    const layout = getLayout();
    const t = ((now - state.start) / 1000) * motion;
    drawField(layout, t, elapsed);
    requestAnimationFrame(drawFrame);
  }

  function drawField(L, t, elapsed) {
    const { cx, cy, scale: s } = L;
    const rx = Math.min(L.width * 0.43, 370) * s;
    const ry = Math.min(L.height * 0.35, 190) * s;
    const tilt = 0.23;
    const primary = "#c8eef0";
    const muted = "#9fb6c5";
    const activeCount = state.tasks.filter((task) => task.status === "doing").length;
    const openCount = state.tasks.filter((task) => !["done", "archived"].includes(task.status)).length;
    const progress = state.tasks.length ? state.tasks.filter((task) => task.status === "done").length / state.tasks.length : 0;
    const categories = nodes.map(([id, label], index) => {
      const meta = state.categories.find((entry) => entry[0] === id);
      const color = meta ? meta[2] : "#8eb9c1";
      const belonging = state.tasks.filter((task) => task.category === id && !["done", "archived"].includes(task.status));
      const angle = (index / nodes.length) * TAU + 0.035 * t + Math.sin(t * 0.13 + index * 0.71) * 0.018 * motion;
      const depth = Math.sin(angle * 2 + tilt) * 0.5 + 0.5;
      const px = cx + Math.cos(angle) * rx;
      const py = cy + Math.sin(angle) * ry + (depth - 0.5) * 36 * s;
      return { id, label, color, angle, depth, x: px, y: py, count: belonging.length, priority: Math.max(0, ...belonging.map((task) => task.priority || 0)) };
    });

    drawHalo(cx, cy, rx, ry, s, t, motion);
    drawAxis(L, s);
    drawLinks(categories, cx, cy, t, s, motion);
    drawCore(cx, cy, s, t, activeCount, openCount, progress, motion);
    categories.slice().sort((a, b) => a.depth - b.depth).forEach((node) => drawNode(node, s, t, motion));
    drawTelemetry(L, s, openCount, activeCount, progress, elapsed);
  }

  function drawHalo(cx, cy, rx, ry, s, t, motion) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.08);
    for (let index = 0; index < 3; index++) {
      const expand = index * 18 * s + Math.sin(t * 0.24 + index) * 2.8 * s * motion;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + expand, ry + expand * 0.38, 0, 0, TAU);
      ctx.strokeStyle = `rgba(118,190,201,${alpha(index === 0 ? 0.19 : 0.075)})`;
      ctx.lineWidth = index === 0 ? 0.9 : 0.55;
      ctx.setLineDash(index === 1 ? [2 * s, 10 * s] : []);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawAxis(L, s) {
    const { cx, cy } = L;
    ctx.save();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = `rgba(141,181,195,${alpha(0.12)})`;
    ctx.beginPath(); ctx.moveTo(cx - L.width * 0.44, cy); ctx.lineTo(cx + L.width * 0.44, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - L.height * 0.34); ctx.lineTo(cx, cy + L.height * 0.34); ctx.stroke();
    for (let i = -4; i <= 4; i++) {
      if (!i) continue;
      ctx.beginPath(); ctx.moveTo(cx + i * 42 * s, cy - 3 * s); ctx.lineTo(cx + i * 42 * s, cy + 3 * s); ctx.stroke();
    }
    ctx.restore();
  }

  function drawLinks(items, cx, cy, t, s, motion) {
    ctx.save();
    ctx.lineWidth = 0.75;
    items.forEach((node, index) => {
      const next = items[(index + 1) % items.length];
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.quadraticCurveTo(cx + Math.cos(node.angle + 0.1) * 30 * s, cy + Math.sin(node.angle) * 18 * s, next.x, next.y);
      ctx.strokeStyle = `rgba(117,172,191,${alpha(0.11 + node.depth * 0.055)})`;
      ctx.stroke();
    });
    const route = Math.floor(t * 0.045) % items.length;
    const phase = (t * 0.22 * motion) % 1;
    const from = items[route], to = items[(route + 1) % items.length];
    const px = from.x + (to.x - from.x) * phase;
    const py = from.y + (to.y - from.y) * phase;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, 15 * s);
    glow.addColorStop(0, `rgba(210,246,238,${alpha(0.52)})`);
    glow.addColorStop(1, "rgba(170,234,225,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, 15 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawCore(cx, cy, s, t, active, open, progress, motion) {
    const r = 33 * s;
    ctx.save();
    ctx.shadowColor = "rgba(104,207,210,.24)";
    ctx.shadowBlur = 24 * s;
    const center = ctx.createRadialGradient(cx - 5 * s, cy - 8 * s, 2 * s, cx, cy, r * 1.12);
    center.addColorStop(0, `rgba(189,228,226,${alpha(0.15)})`);
    center.addColorStop(0.55, `rgba(67,119,139,${alpha(0.09)})`);
    center.addColorStop(1, "rgba(45,72,94,0)");
    ctx.fillStyle = center; ctx.beginPath(); ctx.arc(cx, cy, r * 1.12, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(191,229,225,${alpha(0.78)})`;
    ctx.lineWidth = 1.05;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI * 0.78, Math.PI * 0.78); ctx.stroke();
    ctx.strokeStyle = `rgba(233,179,115,${alpha(0.82)})`;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.79, Math.PI * 0.79 + Math.max(0.04, progress * TAU * 0.42)); ctx.stroke();
    ctx.setLineDash([1.5 * s, 5 * s]);
    ctx.strokeStyle = `rgba(162,199,207,${alpha(0.38)})`;
    ctx.beginPath(); ctx.arc(cx, cy, r + 6 * s + Math.sin(t * 0.2) * s * motion, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(231,244,241,${alpha(0.92)})`;
    ctx.font = `600 ${13 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillText("QG", cx, cy - 3 * s);
    ctx.fillStyle = `rgba(166,196,202,${alpha(0.76)})`;
    ctx.font = `500 ${7.5 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillText(`${active} ACTIF${active === 1 ? "" : "S"} · ${open} OUVERT${open === 1 ? "" : "S"}`, cx, cy + 10 * s);
    ctx.restore();
  }

  function drawNode(node, s, t, motion) {
    const scale = (0.72 + node.depth * 0.28) * s;
    const radius = (4.2 + node.priority * 0.6) * scale;
    ctx.save();
    ctx.globalAlpha = 0.4 + node.depth * 0.6;
    ctx.shadowColor = node.color;
    ctx.shadowBlur = (node.count ? 12 : 5) * scale;
    ctx.fillStyle = node.color;
    ctx.beginPath(); ctx.arc(node.x, node.y, radius * (1 + Math.sin(t * 0.9 + node.angle) * 0.04 * motion), 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `${node.color}aa`;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(node.x, node.y, radius + 5 * scale + node.count * 0.35 * scale, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(node.x - 10 * scale, node.y); ctx.lineTo(node.x - 6.5 * scale, node.y); ctx.moveTo(node.x + 6.5 * scale, node.y); ctx.lineTo(node.x + 10 * scale, node.y); ctx.stroke();
    ctx.font = `500 ${10 * scale}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillStyle = `rgba(220,236,238,${alpha(0.7 + node.depth * 0.28)})`;
    ctx.textBaseline = "middle";
    const alignRight = Math.cos(node.angle) < -0.35;
    ctx.textAlign = alignRight ? "right" : "left";
    const offset = alignRight ? -13 * scale : 13 * scale;
    ctx.fillText(node.label, node.x + offset, node.y - 2.5 * scale);
    if (node.count) {
      ctx.font = `600 ${7.5 * scale}px Bahnschrift, 'Segoe UI', sans-serif`;
      ctx.fillStyle = `rgba(218,177,126,${alpha(0.88)})`;
      ctx.fillText(`${node.count} OUV.`, node.x + offset, node.y + 9 * scale);
    }
    ctx.restore();
  }

  function drawTelemetry(L, s, open, active, progress, elapsed) {
    const x = L.left + 9 * s, y = L.top + 10 * s;
    ctx.save();
    ctx.font = `600 ${8 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.letterSpacing = `${1.6 * s}px`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = `rgba(186,222,224,${alpha(0.72)})`;
    ctx.fillText("QG / SPATIAL WORKFIELD", x, y);
    ctx.font = `500 ${7 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillStyle = `rgba(158,188,200,${alpha(0.55)})`;
    ctx.fillText("13 UNIVERS · DONNÉES LOCALES", x, y + 15 * s);
    const widthBar = 68 * s;
    ctx.fillStyle = `rgba(141,180,195,${alpha(0.16)})`;
    roundedPath(x, y + 32 * s, widthBar, 2 * s, 1 * s); ctx.fill();
    const gradient = ctx.createLinearGradient(x, 0, x + widthBar, 0);
    gradient.addColorStop(0, `rgba(130,214,210,${alpha(0.92)})`);
    gradient.addColorStop(1, `rgba(220,177,122,${alpha(0.92)})`);
    ctx.fillStyle = gradient;
    roundedPath(x, y + 32 * s, widthBar * Math.max(0.02, progress), 2 * s, 1 * s); ctx.fill();
    const metric = `${open} OUVERT${open === 1 ? "" : "S"}   /   ${active} EN COURS   /   ${Math.round(elapsed * 1000)} MS`;
    ctx.font = `500 ${6.4 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillStyle = `rgba(154,183,194,${alpha(0.46)})`;
    ctx.fillText(metric, x, y + 43 * s);
    ctx.restore();
  }

  window.addEventListener("resize", resize, { passive: true });
  window.qgScene.onSceneState((snapshot) => {
    state.tasks = snapshot.tasks || [];
    state.categories = snapshot.categories || [];
    state.settings = { ...state.settings, ...(snapshot.settings || {}) };
  });
  window.qgScene.onAmbientState((active) => { state.active = active; });
  resize();
  requestAnimationFrame(drawFrame);
})();
