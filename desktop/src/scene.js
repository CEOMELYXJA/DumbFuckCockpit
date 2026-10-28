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
  const dustPalette = ["119,151,154", "149,134,166", "185,154,111", "220,213,199", "121,146,161"];
  const dust = Array.from({ length: 72 }, (_, index) => ({ u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, phase: Math.random() * TAU, size: 0.35 + Math.random() * 0.9, hue: index % 5 }));
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
      const color = meta ? meta[2] : "#8e9d91";
      const belonging = state.tasks.filter((task) => task.category === id && !["done", "archived"].includes(task.status));
      const angle = (index / nodes.length) * TAU + 0.035 * t + Math.sin(t * 0.13 + index * 0.71) * 0.018 * motion;
      const depth = Math.sin(angle * 2 + tilt) * 0.5 + 0.5;
      const px = cx + Math.cos(angle) * rx;
      const py = cy + Math.sin(angle) * ry + (depth - 0.5) * 36 * s;
      return { id, label, color, angle, depth, x: px, y: py, count: belonging.length, priority: Math.max(0, ...belonging.map((task) => task.priority || 0)) };
    });

    drawNebula(cx, cy, rx, ry, s, t, motion);
    drawHalo(cx, cy, rx, ry, s, t, motion);
    drawAxis(L, s);
    drawLinks(categories, cx, cy, t, s, motion);
    drawCore(cx, cy, s, t, activeCount, openCount, progress, motion);
    categories.slice().sort((a, b) => a.depth - b.depth).forEach((node) => drawNode(node, s, t, motion));
    drawTelemetry(L, s, openCount, activeCount, progress, elapsed);
  }

  function drawNebula(cx, cy, rx, ry, s, t, motion) {
    const clouds = [
      { x: -0.38, y: -0.27, rx: 0.76, ry: 0.64, angle: -0.48, rgb: [27, 63, 96], phase: 0.5 },
      { x: 0.36, y: 0.34, rx: 0.83, ry: 0.53, angle: 0.38, rgb: [31, 86, 83], phase: 2.2 },
      { x: 0.55, y: -0.44, rx: 0.65, ry: 0.65, angle: 0.62, rgb: [72, 55, 89], phase: 4.1 },
      { x: -0.14, y: 0.52, rx: 0.59, ry: 0.45, angle: -0.28, rgb: [105, 67, 54], phase: 5.3 }
    ];
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    clouds.forEach((cloud) => {
      const x = cx + cloud.x * rx + Math.sin(t * 0.035 + cloud.phase) * rx * 0.018 * motion;
      const y = cy + cloud.y * ry + Math.cos(t * 0.027 + cloud.phase) * ry * 0.025 * motion;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(cloud.angle + Math.sin(t * 0.018 + cloud.phase) * 0.025 * motion);
      ctx.scale(rx * cloud.rx, ry * cloud.ry);
      const rgb = cloud.rgb.join(",");
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      glow.addColorStop(0, `rgba(${rgb},${alpha(0.14)})`);
      glow.addColorStop(0.32, `rgba(${rgb},${alpha(0.085)})`);
      glow.addColorStop(0.72, `rgba(${rgb},${alpha(0.025)})`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    });
    dust.forEach((point) => {
      if (point.u * point.u + point.v * point.v > 1) return;
      const twinkle = motion ? 0.5 + 0.5 * Math.sin(t * 0.85 + point.phase) : 0.55;
      const x = cx + point.u * rx * 0.84, y = cy + point.v * ry * 0.82;
      ctx.fillStyle = `rgba(${dustPalette[point.hue]},${alpha((0.045 + twinkle * 0.11) * motion + 0.035)})`;
      ctx.beginPath(); ctx.arc(x, y, point.size * s * (0.7 + twinkle * 0.35), 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  function drawHalo(cx, cy, rx, ry, s, t, motion) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.08);
    for (let index = 0; index < 3; index++) {
      const expand = index * 18 * s + Math.sin(t * 0.24 + index) * 2.8 * s * motion;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + expand, ry + expand * 0.38, 0, 0, TAU);
      ctx.strokeStyle = `rgba(143,151,145,${alpha(index === 0 ? 0.16 : 0.06)})`;
      ctx.lineWidth = index === 0 ? 0.9 : 0.55;
      ctx.setLineDash(index === 1 ? [2 * s, 10 * s] : []);
      ctx.stroke();
    }
    ctx.setLineDash([1.5 * s, 8 * s]);
    ctx.lineDashOffset = -t * 0.12 * motion;
    ctx.strokeStyle = `rgba(130,146,143,${alpha(0.12)})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.86, ry * 0.84, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([2 * s, 15 * s]);
    ctx.lineDashOffset = t * 0.08 * motion;
    ctx.strokeStyle = `rgba(185,154,111,${alpha(0.09)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.12, ry * 1.12, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawAxis(L, s) {
    const { cx, cy } = L;
    ctx.save();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = `rgba(143,151,145,${alpha(0.1)})`;
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
      ctx.strokeStyle = `rgba(130,146,143,${alpha(0.1 + node.depth * 0.045)})`;
      ctx.stroke();
    });
    const route = Math.floor(t * 0.045) % items.length;
    const phase = (t * 0.22 * motion) % 1;
    const from = items[route], to = items[(route + 1) % items.length];
    const px = from.x + (to.x - from.x) * phase;
    const py = from.y + (to.y - from.y) * phase;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, 15 * s);
    glow.addColorStop(0, `rgba(220,213,199,${alpha(0.35)})`);
    glow.addColorStop(1, "rgba(185,154,111,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, 15 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawCore(cx, cy, s, t, active, open, progress, motion) {
    const r = 33 * s;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = "rgba(143,151,145,.18)";
    ctx.shadowBlur = 32 * s;
    const center = ctx.createRadialGradient(cx - 5 * s, cy - 8 * s, 2 * s, cx, cy, r * 2.7);
    center.addColorStop(0, `rgba(207,177,128,${alpha(0.24)})`);
    center.addColorStop(0.24, `rgba(125,149,145,${alpha(0.12)})`);
    center.addColorStop(0.58, `rgba(112,90,112,${alpha(0.055)})`);
    center.addColorStop(1, "rgba(45,55,57,0)");
    ctx.fillStyle = center; ctx.beginPath(); ctx.arc(cx, cy, r * 1.12, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(204,196,176,${alpha(0.64)})`;
    ctx.lineWidth = 1.05;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI * 0.78, Math.PI * 0.78); ctx.stroke();
    ctx.strokeStyle = `rgba(185,154,111,${alpha(0.72)})`;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.79, Math.PI * 0.79 + Math.max(0.04, progress * TAU * 0.42)); ctx.stroke();
    ctx.setLineDash([1.5 * s, 5 * s]);
    ctx.strokeStyle = `rgba(143,151,145,${alpha(0.28)})`;
    ctx.beginPath(); ctx.arc(cx, cy, r + 6 * s + Math.sin(t * 0.2) * s * motion, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(231,224,210,${alpha(0.9)})`;
    ctx.font = `600 ${10.5 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillText("DFC", cx, cy - 3 * s);
    ctx.fillStyle = `rgba(166,169,158,${alpha(0.7)})`;
    ctx.font = `500 ${7.5 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillText(`${active} ACTIF${active === 1 ? "" : "S"} · ${open} OUVERT${open === 1 ? "" : "S"}`, cx, cy + 10 * s);
    ctx.restore();
  }

  function drawNode(node, s, t, motion) {
    const scale = (0.72 + node.depth * 0.28) * s;
    const radius = (4.2 + node.priority * 0.6) * scale;
    ctx.save();
    ctx.globalAlpha = 0.4 + node.depth * 0.6;
    const pulse = 1 + Math.sin(t * 0.9 + node.angle) * 0.04 * motion;
    const halo = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * (node.count ? 5 : 3.2));
    halo.addColorStop(0, `${node.color}66`); halo.addColorStop(1, `${node.color}00`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(node.x, node.y, radius * (node.count ? 5 : 3.2), 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(node.x, node.y); ctx.rotate(node.angle * 0.42);
    ctx.beginPath(); ctx.ellipse(0, 0, radius * 2.05, radius * 0.7, 0, 0, TAU);
    ctx.strokeStyle = `${node.color}a8`; ctx.lineWidth = 0.85 * scale; ctx.stroke(); ctx.restore();
    ctx.shadowColor = node.color; ctx.shadowBlur = (node.count ? 14 : 7) * scale;
    const sphere = ctx.createRadialGradient(node.x - radius * 0.38, node.y - radius * 0.42, 0.5, node.x, node.y, radius * 1.45);
    sphere.addColorStop(0, "#e8e2d6"); sphere.addColorStop(0.18, node.color); sphere.addColorStop(0.68, node.color); sphere.addColorStop(1, "rgba(17,21,26,.94)");
    ctx.fillStyle = sphere;
    ctx.beginPath(); ctx.arc(node.x, node.y, radius * pulse, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `${node.color}7d`; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(node.x, node.y, radius + 5 * scale + node.count * 0.35 * scale, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.025, Math.min(1, node.count / 5))); ctx.stroke();
    ctx.font = `500 ${10 * scale}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillStyle = `rgba(220,213,199,${alpha(0.7 + node.depth * 0.28)})`;
    ctx.textBaseline = "middle";
    const alignRight = Math.cos(node.angle) < -0.35;
    ctx.textAlign = alignRight ? "right" : "left";
    const offset = alignRight ? -13 * scale : 13 * scale;
    ctx.fillText(node.label, node.x + offset, node.y - 2.5 * scale);
    if (node.count) {
      ctx.font = `600 ${7.5 * scale}px Bahnschrift, 'Segoe UI', sans-serif`;
      ctx.fillStyle = `rgba(185,154,111,${alpha(0.82)})`;
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
    ctx.fillStyle = `rgba(220,213,199,${alpha(0.72)})`;
    ctx.fillText("DUMBFUCKCOCKPIT / WIDGET", x, y);
    ctx.font = `500 ${7 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillStyle = `rgba(166,169,158,${alpha(0.55)})`;
    ctx.fillText("13 SECTEURS · COUCHE TRANSPARENTE", x, y + 15 * s);
    const widthBar = 68 * s;
    ctx.fillStyle = `rgba(143,151,145,${alpha(0.14)})`;
    roundedPath(x, y + 32 * s, widthBar, 2 * s, 1 * s); ctx.fill();
    const gradient = ctx.createLinearGradient(x, 0, x + widthBar, 0);
    gradient.addColorStop(0, `rgba(125,149,145,${alpha(0.82)})`);
    gradient.addColorStop(1, `rgba(185,154,111,${alpha(0.82)})`);
    ctx.fillStyle = gradient;
    roundedPath(x, y + 32 * s, widthBar * Math.max(0.02, progress), 2 * s, 1 * s); ctx.fill();
    const metric = `${open} OUVERT${open === 1 ? "" : "S"}   /   ${active} EN COURS   /   ${Math.round(elapsed * 1000)} MS`;
    ctx.font = `500 ${6.4 * s}px Bahnschrift, 'Segoe UI', sans-serif`;
    ctx.fillStyle = `rgba(166,169,158,${alpha(0.44)})`;
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

