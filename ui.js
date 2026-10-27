// Colores por categoría, en el orden de MonosSim.COLOR.
const PALETTE = [
  "#000000", // Arruinado
  "#ff9800", // Perdiendo (<900)
  "#ffeb3b", // Neutro (900-1100)
  "#4caf50", // Ganando (>1100)
  "#00e676", // x2
  "#2196f3", // x3
  "#f44336", // x5
  "#ff00ff", // x10
];

const COLS = 40;
const ROWS = 25;
const STATS_INTERVAL_MS = 66;
const SMOOTHING = 0.1;

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

// DOM Elements
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playPauseBtn = document.getElementById("playPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const statsBtn = document.getElementById("statsBtn");
const speedSlider = document.getElementById("speedSlider");
const matchCountEl = document.getElementById("matchCount");
const totalMoneyEl = document.getElementById("totalMoney");
const tooltip = document.getElementById("tooltip");
const iconPlay = document.getElementById("icon-play");
const iconPause = document.getElementById("icon-pause");

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
}

function toggleGame() {
  setPlaying(!isPlaying);
  engine.post({ type: isPlaying ? "START" : "STOP" });
}

function resetGame() {
  setPlaying(false);
  engine.post({ type: "RESET" });
  // Fuerza a reiniciar la animación con la próxima actualización.
  banks = new Int32Array(0);
}

function updateStats() {
  matchCountEl.textContent = matchCount.toLocaleString();
  const stats = MonosSim.calculateStats(banks);
  totalMoneyEl.textContent = stats.totalMoney.toLocaleString() + "€";

  const total = banks.length || 1;
  for (const key of STAT_KEYS) {
    const pct = Math.round((stats[key] / total) * 100);
    statEls[key].textContent = `${stats[key]} (${pct}%)`;
  }
  for (const key of BAR_KEYS) {
    pbEls[key].style.width = (stats[key] / total) * 100 + "%";
  }
}

// Render loop: interpola el color y solo repinta si algo ha cambiado.
function renderLoop() {
  let moving = false;
  for (let i = 0; i < banks.length; i++) {
    const diff = banks[i] - visualBanks[i];
    if (Math.abs(diff) > 0.5) {
      visualBanks[i] += diff * SMOOTHING;
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
    // Los arruinados se ven en negro al momento, sin transición.
    colorIndexes[i] = banks[i] <= 0 ? 0 : MonosSim.colorIndex(visualBanks[i]);
  }

  const cellWidth = cssWidth / COLS;
  const cellHeight = cssHeight / ROWS;
  const padding = 1;
  const w = Math.max(0, cellWidth - padding * 2);
  const h = Math.max(0, cellHeight - padding * 2);

  // Una pasada por color: cambiar fillStyle 1000 veces por fotograma es caro.
  for (let c = 0; c < PALETTE.length; c++) {
    ctx.fillStyle = PALETTE[c];
    for (let i = 0; i < banks.length; i++) {
      if (colorIndexes[i] !== c) continue;
      const x = (i % COLS) * cellWidth;
      const y = Math.floor(i / COLS) * cellHeight;
      ctx.fillRect(x + padding, y + padding, w, h);
    }
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
    needsRedraw = true;
  }
  updateCanvasRect();
}

// Interaction
function handleInteraction(clientX, clientY) {
  if (!canvasRect) updateCanvasRect();
  const col = Math.floor(((clientX - canvasRect.left) / cssWidth) * COLS);
  const row = Math.floor(((clientY - canvasRect.top) / cssHeight) * ROWS);
  const index = row * COLS + col;

  if (col < 0 || col >= COLS || index < 0 || index >= banks.length) {
    tooltip.style.display = "none";
    return;
  }

  tooltip.style.display = "block";
  let tooltipX = clientX + 15;
  let tooltipY = clientY + 15;
  if (tooltipX + 150 > innerWidth) tooltipX = clientX - 160;
  if (tooltipY + 100 > innerHeight) tooltipY = clientY - 110;
  tooltip.style.left = tooltipX + "px";
  tooltip.style.top = tooltipY + "px";

  tooltip.textContent = "";
  const title = document.createElement("strong");
  title.style.color = "var(--accent-color)";
  title.textContent = `Agente #${index}`;
  tooltip.appendChild(title);
  tooltip.appendChild(document.createElement("br"));
  tooltip.appendChild(document.createTextNode(`Banca: ${banks[index]}€`));
  if (banks[index] <= 0) {
    tooltip.appendChild(document.createElement("br"));
    const ruinedSpan = document.createElement("span");
    ruinedSpan.style.color = "var(--danger-color)";
    ruinedSpan.textContent = `Arruinado (Ronda ${ruinedAts[index].toLocaleString()})`;
    tooltip.appendChild(ruinedSpan);
  }
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
    location.href = "seguimiento.html";
  } catch (e) {
    Logger.error("Error saving stats:", e);
    alert("Error al guardar datos de seguimiento.");
  }
}

canvas.addEventListener("mousemove", (e) => handleInteraction(e.clientX, e.clientY));
canvas.addEventListener("click", (e) => handleInteraction(e.clientX, e.clientY));
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 0) handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
  },
  { passive: true },
);
canvas.addEventListener("mouseleave", () => (tooltip.style.display = "none"));

// Controls
playPauseBtn.addEventListener("click", toggleGame);
resetBtn.addEventListener("click", resetGame);
speedSlider.addEventListener("input", (e) => {
  engine.post({ type: "SPEED", value: e.target.value });
});
statsBtn.addEventListener("click", () => {
  if (isPlaying) toggleGame();
  engine.post({ type: "GET_HISTORY" });
});

addEventListener("resize", resizeCanvas);
addEventListener("scroll", updateCanvasRect, { passive: true });

// Init
engine.post({ type: "SPEED", value: speedSlider.value });
engine.post({ type: "INIT" });
resizeCanvas();
setTimeout(resizeCanvas, 50);
requestAnimationFrame(renderLoop);
