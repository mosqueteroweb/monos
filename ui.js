// Colores por categoría, en el orden de MonosSim.COLOR.
const PALETTE = [
  "#607d8b", // Arruinado (gris: el negro no se distingue del fondo)
  "#ff9800", // Perdiendo (<900)
  "#ffeb3b", // Neutro (900-1100)
  "#4caf50", // Ganando (>1100)
  "#00e676", // x2
  "#2196f3", // x3
  "#f44336", // x5
  "#ff00ff", // x10
];

const GRID_LONG = 40;
const GRID_SHORT = 25;
const STATS_INTERVAL_MS = 66;
// Velocidad: el deslizador (0-100) es logarítmico, de 1 a 10 000 rondas por paso.
const sliderToRounds = (value) => Math.round(10 ** (value / 25));
const roundsToSlider = (rounds) => Math.round(25 * Math.log10(rounds));
// Al entrar, la simulación arranca despacio y acelera sola hasta esta velocidad.
const RAMP_TARGET_ROUNDS = 1000;
const RAMP_DURATION_MS = 15000;
const RAMP_STEP_MS = 100;
const TOUCH_TOOLTIP_MS = 3000;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const smoothing = () => (reducedMotion.matches ? 1 : 0.1);

// State
let banks = new Int32Array(0);
let ruinedAts = new Int32Array(0);
let visualBanks = new Float64Array(0);
let colorIndexes = new Uint8Array(0);
let matchCount = 0;
let isPlaying = false;
let needsRedraw = true;
let lastStatsTime = 0;
let cssWidth = 0;
let cssHeight = 0;
let canvasRect = null;
// 40×25 en horizontal y 25×40 en vertical, para que las casillas no salgan
// finísimas en un móvil.
let cols = GRID_LONG;
let rows = GRID_SHORT;
let selectedIndex = -1; // Casilla elegida con el teclado
let tooltipTimer = null;
let rampElapsed = 0;
let rampTimer = null;
let resumeAfterInfo = false;

// DOM Elements
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playPauseBtn = document.getElementById("playPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const statsBtn = document.getElementById("statsBtn");
const speedSlider = document.getElementById("speedSlider");
const matchCountEl = document.getElementById("matchCount");
const bankResultEl = document.getElementById("bankResult");
const bankArrowEl = document.getElementById("bankArrow");
const bankValueEl = document.getElementById("bankValue");
const infoBtn = document.getElementById("infoBtn");
const infoDialog = document.getElementById("infoDialog");
const infoClose = document.getElementById("infoClose");
const tooltip = document.getElementById("tooltip");
const iconPlay = document.getElementById("icon-play");
const iconPause = document.getElementById("icon-pause");
const trackingOverlay = document.getElementById("trackingOverlay");
const trackingFrame = document.getElementById("trackingFrame");
const playerInfo = document.getElementById("playerInfo");
// Lo que queda detrás del seguimiento mientras está abierto.
const backgroundRegions = ["header", "main", "#statsPanel"].map((s) =>
  document.querySelector(s),
);

const STAT_KEYS = ["ruined", "losing", "neutral", "winning", "x2", "x3", "x5", "x10"];
const BAR_KEYS = ["ruined", "losing", "neutral", "winning"];
const statEls = Object.fromEntries(
  STAT_KEYS.map((key) => [key, document.getElementById(`stat-${key}`)]),
);
const pbEls = Object.fromEntries(
  BAR_KEYS.map((key) => [key, document.getElementById(`pb-${key}`)]),
);

/**
 * Lanza la simulación en un Web Worker. Si el navegador no lo permite (por
 * ejemplo, al abrir la página con file://), la ejecuta en este mismo hilo.
 */
function createEngine(onMessage) {
  const runLocally = () => {
    Logger.info("Web Worker no disponible: la simulación corre en el hilo principal.");
    const controller = MonosSim.createController((message) => onMessage(message));
    return { post: (message) => controller.handle(message) };
  };

  let worker;
  try {
    worker = new Worker("worker.js");
  } catch (e) {
    return runLocally();
  }

  let send = (message) => worker.postMessage(message);
  let confirmed = false;
  // Mensajes enviados antes de saber si el Worker arranca, para repetirlos.
  const unconfirmed = [];

  worker.onmessage = (e) => {
    confirmed = true;
    onMessage(e.data);
  };
  // Algunos navegadores no lanzan excepción y avisan con un error asíncrono.
  worker.onerror = (e) => {
    Logger.error("Error en el Worker:", e.message);
    if (confirmed) return;
    e.preventDefault();
    worker.terminate();
    confirmed = true;
    send = runLocally().post;
    unconfirmed.forEach((message) => send(message));
  };

  return {
    post(message) {
      if (!confirmed) unconfirmed.push(message);
      send(message);
    },
  };
}

const engine = createEngine(handleEngineMessage);

function handleEngineMessage(data) {
  if (data.type === "UPDATE") {
    applyUpdate(data);
  } else if (data.type === "FINISHED") {
    setPlaying(false);
    updateStats();
  } else if (data.type === "HISTORY") {
    saveHistoryAndOpen(data);
  }
}

function applyUpdate(data) {
  const resized = banks.length !== data.banks.length;
  banks = data.banks;
  ruinedAts = data.ruinedAts;
  matchCount = data.matchCount;
  if (resized) {
    visualBanks = Float64Array.from(banks);
    colorIndexes = new Uint8Array(banks.length);
  }
  if (selectedIndex >= 0 && tooltip.style.display === "block") showSelectedPlayer(false);
  needsRedraw = true;

  const now = performance.now();
  if (resized || !isPlaying || now - lastStatsTime > STATS_INTERVAL_MS) {
    updateStats();
    lastStatsTime = now;
  }
}

function setPlaying(playing) {
  isPlaying = playing;
  iconPlay.classList.toggle("hidden", playing);
  iconPause.classList.toggle("hidden", !playing);
  playPauseBtn.classList.toggle("active", playing);
  const label = playing ? "Pausar" : "Iniciar";
  playPauseBtn.setAttribute("aria-label", label);
  playPauseBtn.title = label;
}

function toggleGame() {
  setPlaying(!isPlaying);
  engine.post({ type: isPlaying ? "START" : "STOP" });
}

function resetGame() {
  stopRamp();
  setPlaying(false);
  engine.post({ type: "RESET" });
  // Fuerza a reiniciar la animación con la próxima actualización.
  banks = new Int32Array(0);
}

function updateStats() {
  matchCountEl.textContent = matchCount.toLocaleString();
  const stats = MonosSim.calculateStats(banks);
  updateBank(banks.length * MonosSim.DEFAULTS.initialBank - stats.totalMoney);

  const total = banks.length || 1;
  for (const key of STAT_KEYS) {
    const pct = Math.round((stats[key] / total) * 100);
    statEls[key].textContent = `${stats[key]} (${pct}%)`;
  }
  for (const key of BAR_KEYS) {
    pbEls[key].style.width = (stats[key] / total) * 100 + "%";
  }
}

// La banca gana lo que los monos pierden en conjunto, y al revés.
function updateBank(result) {
  const amount = Math.abs(result).toLocaleString() + " €";
  const state = result > 0 ? "up" : result < 0 ? "down" : "even";
  bankResultEl.classList.toggle("is-up", state === "up");
  bankResultEl.classList.toggle("is-down", state === "down");
  bankResultEl.classList.toggle("is-even", state === "even");
  bankArrowEl.textContent = { up: "▲", down: "▼", even: "–" }[state];
  bankValueEl.textContent = { up: "+", down: "−", even: "" }[state] + amount;
  bankResultEl.setAttribute(
    "aria-label",
    { up: `Banca gana ${amount}`, down: `Banca pierde ${amount}`, even: "Banca en tablas" }[state],
  );
}

function setSpeed(rounds) {
  speedSlider.value = roundsToSlider(rounds);
  engine.post({ type: "SPEED", value: rounds });
  speedSlider.setAttribute(
    "aria-valuetext",
    rounds === 1 ? "1 ronda por paso" : `${rounds.toLocaleString()} rondas por paso`,
  );
}

// Aceleración exponencial de 1 a RAMP_TARGET_ROUNDS; solo avanza mientras
// se juega y se detiene en cuanto el usuario toca la velocidad.
function startRamp() {
  rampElapsed = 0;
  setSpeed(1);
  clearInterval(rampTimer);
  rampTimer = setInterval(() => {
    if (!isPlaying) return;
    rampElapsed += RAMP_STEP_MS;
    const progress = Math.min(1, rampElapsed / RAMP_DURATION_MS);
    setSpeed(Math.max(1, Math.round(RAMP_TARGET_ROUNDS ** progress)));
    if (progress === 1) stopRamp();
  }, RAMP_STEP_MS);
}

function stopRamp() {
  clearInterval(rampTimer);
  rampTimer = null;
}

function openInfo() {
  resumeAfterInfo = isPlaying;
  if (isPlaying) toggleGame();
  infoDialog.showModal();
}

// Render loop: interpola el color y solo repinta si algo ha cambiado.
function renderLoop() {
  let moving = false;
  for (let i = 0; i < banks.length; i++) {
    const diff = banks[i] - visualBanks[i];
    if (Math.abs(diff) > 0.5) {
      visualBanks[i] += diff * smoothing();
      moving = true;
    } else {
      visualBanks[i] = banks[i];
    }
  }
  if (moving || needsRedraw) {
    draw();
    needsRedraw = false;
  }
  requestAnimationFrame(renderLoop);
}

function draw() {
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  if (banks.length === 0) return;

  for (let i = 0; i < banks.length; i++) {
    // Los arruinados cambian de color al momento, sin transición.
    colorIndexes[i] = banks[i] <= 0 ? 0 : MonosSim.colorIndex(visualBanks[i]);
  }

  const cellWidth = cssWidth / cols;
  const cellHeight = cssHeight / rows;
  const padding = 1;
  const w = Math.max(0, cellWidth - padding * 2);
  const h = Math.max(0, cellHeight - padding * 2);

  // Una pasada por color: cambiar fillStyle 1000 veces por fotograma es caro.
  for (let c = 0; c < PALETTE.length; c++) {
    ctx.fillStyle = PALETTE[c];
    for (let i = 0; i < banks.length; i++) {
      if (colorIndexes[i] !== c) continue;
      const x = (i % cols) * cellWidth;
      const y = Math.floor(i / cols) * cellHeight;
      ctx.fillRect(x + padding, y + padding, w, h);
    }
  }

  if (selectedIndex >= 0 && document.activeElement === canvas) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      (selectedIndex % cols) * cellWidth + 1,
      Math.floor(selectedIndex / cols) * cellHeight + 1,
      cellWidth - 2,
      cellHeight - 2,
    );
  }
}

function updateCanvasRect() {
  canvasRect = canvas.getBoundingClientRect();
}

function resizeCanvas() {
  const parent = canvas.parentElement;
  if (parent.clientWidth > 0 && parent.clientHeight > 0) {
    const dpr = window.devicePixelRatio || 1;
    cssWidth = parent.clientWidth;
    cssHeight = parent.clientHeight;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Elige la orientación con casillas más cuadradas.
    const landscape = cssWidth >= cssHeight;
    cols = landscape ? GRID_LONG : GRID_SHORT;
    rows = landscape ? GRID_SHORT : GRID_LONG;
    needsRedraw = true;
  }
  updateCanvasRect();
}

// Interaction
function cellAt(clientX, clientY) {
  if (!canvasRect) updateCanvasRect();
  const col = Math.floor(((clientX - canvasRect.left) / cssWidth) * cols);
  const row = Math.floor(((clientY - canvasRect.top) / cssHeight) * rows);
  const index = row * cols + col;
  return col < 0 || col >= cols || index < 0 || index >= banks.length ? -1 : index;
}

function describePlayer(index) {
  const lines = [`Agente #${index}`, `Banca: ${banks[index].toLocaleString()}€`];
  if (banks[index] <= 0) lines.push(`Arruinado (Ronda ${ruinedAts[index].toLocaleString()})`);
  return lines;
}

function hideTooltip() {
  tooltip.style.display = "none";
}

function showTooltip(index, clientX, clientY) {
  if (index < 0) {
    hideTooltip();
    return;
  }
  const [title, ...rest] = describePlayer(index);
  tooltip.textContent = "";
  const strong = document.createElement("strong");
  strong.className = "tooltip-title";
  strong.textContent = title;
  tooltip.appendChild(strong);
  rest.forEach((line, i) => {
    tooltip.appendChild(document.createElement("br"));
    const span = document.createElement("span");
    if (i === 1) span.className = "tooltip-ruined";
    span.textContent = line;
    tooltip.appendChild(span);
  });

  // Se mide tras rellenarlo para que no se salga de la pantalla.
  tooltip.style.display = "block";
  const { offsetWidth: w, offsetHeight: h } = tooltip;
  let x = clientX + 15;
  let y = clientY + 15;
  if (x + w > innerWidth - 8) x = clientX - w - 15;
  if (y + h > innerHeight - 8) y = clientY - h - 15;
  tooltip.style.left = Math.max(8, x) + "px";
  tooltip.style.top = Math.max(8, y) + "px";
}

// Teclado: las flechas recorren las casillas y se anuncia cada jugador.
function showSelectedPlayer(announce) {
  const cellWidth = cssWidth / cols;
  const cellHeight = cssHeight / rows;
  if (!canvasRect) updateCanvasRect();
  const x = canvasRect.left + ((selectedIndex % cols) + 0.5) * cellWidth;
  const y = canvasRect.top + (Math.floor(selectedIndex / cols) + 0.5) * cellHeight;
  showTooltip(selectedIndex, x, y);
  if (announce) playerInfo.textContent = describePlayer(selectedIndex).join(". ");
  needsRedraw = true;
}

function handleCanvasKey(e) {
  if (banks.length === 0) return;
  const moves = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -cols,
    ArrowDown: cols,
    Home: -Infinity,
    End: Infinity,
  };
  if (!(e.key in moves)) return;
  e.preventDefault();
  const current = selectedIndex < 0 ? 0 : selectedIndex;
  const next = current + moves[e.key];
  selectedIndex = Math.min(banks.length - 1, Math.max(0, next));
  showSelectedPlayer(true);
}

function saveHistoryAndOpen(data) {
  try {
    localStorage.setItem(
      "seguimientoData",
      JSON.stringify({
        ids: data.ids,
        points: data.points,
        history: data.history,
        rounds: data.rounds,
      }),
    );
  } catch (e) {
    Logger.error("Error saving stats:", e);
    alert("Error al guardar datos de seguimiento.");
    return;
  }
  // Se abre encima del juego, que queda en pausa con su estado intacto.
  trackingFrame.src = "seguimiento.html";
  trackingOverlay.classList.remove("hidden");
  backgroundRegions.forEach((el) => (el.inert = true));
  hideTooltip();
}

function closeTracking() {
  trackingOverlay.classList.add("hidden");
  trackingFrame.src = "about:blank";
  backgroundRegions.forEach((el) => (el.inert = false));
  statsBtn.focus();
}

// Al cargar el seguimiento, el foco pasa a su botón de volver.
trackingFrame.addEventListener("load", () => {
  if (trackingOverlay.classList.contains("hidden")) return;
  const back = trackingFrame.contentDocument?.getElementById("backBtn");
  if (back) back.focus();
});

addEventListener("message", (e) => {
  if (e.origin === location.origin && e.data && e.data.type === "CLOSE_TRACKING") {
    closeTracking();
  }
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !trackingOverlay.classList.contains("hidden")) closeTracking();
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") showTooltip(cellAt(e.clientX, e.clientY), e.clientX, e.clientY);
});
canvas.addEventListener("mouseleave", hideTooltip);
// En el móvil no hay "salir del canvas": la ficha se oculta sola.
canvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  showTooltip(cellAt(e.clientX, e.clientY), e.clientX, e.clientY);
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(hideTooltip, TOUCH_TOOLTIP_MS);
});
canvas.addEventListener("keydown", handleCanvasKey);
canvas.addEventListener("focus", () => (needsRedraw = true));
canvas.addEventListener("blur", () => {
  hideTooltip();
  needsRedraw = true;
});

// Controls
playPauseBtn.addEventListener("click", toggleGame);
resetBtn.addEventListener("click", resetGame);
speedSlider.addEventListener("input", (e) => {
  stopRamp();
  setSpeed(sliderToRounds(Number(e.target.value)));
});
infoBtn.addEventListener("click", openInfo);
infoClose.addEventListener("click", () => infoDialog.close());
// Al cerrar la información (botón, Escape o fuera), se sigue jugando si se estaba.
infoDialog.addEventListener("close", () => {
  if (resumeAfterInfo && !isPlaying) toggleGame();
  resumeAfterInfo = false;
  infoBtn.focus();
});
infoDialog.addEventListener("click", (e) => {
  if (e.target === infoDialog) infoDialog.close();
});
statsBtn.addEventListener("click", () => {
  if (isPlaying) toggleGame();
  engine.post({ type: "GET_HISTORY" });
});

addEventListener("resize", resizeCanvas);
addEventListener("scroll", updateCanvasRect, { passive: true });

// Init: arranca sola, despacio, y va acelerando.
engine.post({ type: "INIT" });
startRamp();
toggleGame();
resizeCanvas();
setTimeout(resizeCanvas, 50);
requestAnimationFrame(renderLoop);
