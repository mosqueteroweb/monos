// Constants
const INITIAL_BANK = 1000;
const BET_AMOUNT = 1;
const PLAYER_COUNT = 1000;
const TRACKED_PLAYER_IDS = [500, 334, 23, 765];
const MAX_TRACKED_ROUNDS = 100000;

// Configurable via slider
let simulationSpeed = 1000;

const BANK_COLORS = {
  BLACK: "#000000", // Ruined
  ORANGE: "#ff9800", // Losing (<900)
  YELLOW: "#ffeb3b", // Neutral (901-1099)
  GREEN_NORMAL: "#4caf50", // Winning (>1100)
  GREEN_HIGHLIGHT: "#00e676", // x2
  BLUE: "#2196f3", // x3
  RED: "#f44336", // x5
  FUCHSIA: "#ff00ff", // x10
};

// State
let players = [];
let matchCount = 0;
let isPlaying = false;
let animationId;
let lastUITime = 0;
let trackedHistory = {};

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

// Icons
const iconPlay = document.getElementById("icon-play");
const iconPause = document.getElementById("icon-pause");

// Stats Elements
const statEls = {
  ruined: document.getElementById("stat-ruined"),
  losing: document.getElementById("stat-losing"),
  neutral: document.getElementById("stat-neutral"),
  winning: document.getElementById("stat-winning"),
  x2: document.getElementById("stat-x2"),
  x3: document.getElementById("stat-x3"),
  x5: document.getElementById("stat-x5"),
  x10: document.getElementById("stat-x10"),
};

// Progress Bars
const pbEls = {
  ruined: document.getElementById("pb-ruined"),
  losing: document.getElementById("pb-losing"),
  neutral: document.getElementById("pb-neutral"),
  winning: document.getElementById("pb-winning"),
};

class SecureBatchRNG {
  constructor() {
    this.BUFFER_SIZE = 128 * 1024;
    this.buffer = new Uint8Array(this.BUFFER_SIZE);
    this.bitIndex = 0;

    // Pre-calculate chunks to avoid temporary views in refill()
    this.views = [];
    const CHUNK_SIZE = 65536;
    for (let offset = 0; offset < this.BUFFER_SIZE; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, this.BUFFER_SIZE);
      this.views.push(this.buffer.subarray(offset, end));
    }
  }

  refill() {
    for (let i = 0; i < this.views.length; i++) {
      window.crypto.getRandomValues(this.views[i]);
    }
    this.bitIndex = 0;
  }

  getBit() {
    if (this.bitIndex >= this.BUFFER_SIZE * 8) {
      this.refill();
    }
    const byteIndex = this.bitIndex >> 3;
    const bitOffset = this.bitIndex & 7;
    const bit = (this.buffer[byteIndex] >> bitOffset) & 1;
    this.bitIndex++;
    return bit;
  }
}

const rng = new SecureBatchRNG();

class Player {
  constructor(id) {
    this.id = id;
    this.bank = INITIAL_BANK;
    this.visualBank = INITIAL_BANK; // Smooth transitions
    this.active = true;
    this.maxBank = INITIAL_BANK;
    this.ruinedAt = null;
  }

  play(coinSide) {
    if (!this.active) return;

    const choice = rng.getBit();

    if (choice === coinSide) {
      this.bank += BET_AMOUNT;
      if (this.bank > this.maxBank) this.maxBank = this.bank;
    } else {
      this.bank -= BET_AMOUNT;
      if (this.bank <= 0) {
        this.bank = 0;
        this.active = false;
        this.ruinedAt = matchCount;
      }
    }
  }
}

function initGame() {
  players = [];
  matchCount = 0;
  trackedHistory = {};
  TRACKED_PLAYER_IDS.forEach((id) => {
    trackedHistory[id] = [INITIAL_BANK];
  });

  rng.refill();
  for (let i = 0; i < PLAYER_COUNT; i++) {
    players.push(new Player(i));
  }
  updateUI();
  resizeCanvas();
}

function toggleGame() {
  isPlaying = !isPlaying;
  if (isPlaying) {
    iconPlay.classList.add("hidden");
    iconPause.classList.remove("hidden");

    playPauseBtn.classList.add("active");
    animationId = requestAnimationFrame(gameLoop);
  } else {
    iconPlay.classList.remove("hidden");
    iconPause.classList.add("hidden");

    playPauseBtn.classList.remove("active");
    cancelAnimationFrame(animationId);
  }
}

function resetGame() {
  isPlaying = false;
  cancelAnimationFrame(animationId);

  iconPlay.classList.remove("hidden");
  iconPause.classList.add("hidden");

  playPauseBtn.classList.remove("active");
  initGame();
}

function gameLoop(timestamp) {
  if (!isPlaying) return;
  if (!timestamp) timestamp = performance.now();

  // Use dynamic speed from slider
  const currentSpeed = simulationSpeed;

  for (let i = 0; i < currentSpeed; i++) {
    matchCount++;
    const coinSide = rng.getBit();
    for (let j = 0; j < PLAYER_COUNT; j++) {
      players[j].play(coinSide);
    }

    if (matchCount <= MAX_TRACKED_ROUNDS) {
      for (const id of TRACKED_PLAYER_IDS) {
        trackedHistory[id].push(players[id].bank);
      }
    }
  }

  if (timestamp - lastUITime > 66) {
    updateUI();
    lastUITime = timestamp;
  }

  // Interpolation for smooth visualization
  for (let j = 0; j < PLAYER_COUNT; j++) {
    players[j].visualBank += (players[j].bank - players[j].visualBank) * 0.1;
  }

  draw();
  animationId = requestAnimationFrame(gameLoop);
}

function updateUI() {
  matchCountEl.textContent = matchCount.toLocaleString();

  let stats = {
    ruined: 0,
    losing: 0, // < 900
    neutral: 0, // 900-1100
    winning: 0, // > 1100
    x2: 0,
    x3: 0,
    x5: 0,
    x10: 0,
  };

  let totalMoney = 0;

  for (const p of players) {
    totalMoney += p.bank;
    if (p.bank <= 0) stats.ruined++;
    else if (p.bank <= 900) stats.losing++;
    else if (p.bank <= 1099) stats.neutral++;
    else stats.winning++;

    // Accumulative stats for highlighting
    if (p.bank >= 2000) stats.x2++;
    if (p.bank >= 3000) stats.x3++;
    if (p.bank >= 5000) stats.x5++;
    if (p.bank >= 10000) stats.x10++;
  }

  totalMoneyEl.textContent = totalMoney.toLocaleString() + "€";

  const total = PLAYER_COUNT;

  const getPct = (val) => Math.round((val / total) * 100);

  statEls.ruined.textContent = `${stats.ruined} (${getPct(stats.ruined)}%)`;
  statEls.losing.textContent = `${stats.losing} (${getPct(stats.losing)}%)`;
  statEls.neutral.textContent = `${stats.neutral} (${getPct(stats.neutral)}%)`;
  statEls.winning.textContent = `${stats.winning} (${getPct(stats.winning)}%)`;
  statEls.x2.textContent = `${stats.x2} (${getPct(stats.x2)}%)`;
  statEls.x3.textContent = `${stats.x3} (${getPct(stats.x3)}%)`;
  statEls.x5.textContent = `${stats.x5} (${getPct(stats.x5)}%)`;
  statEls.x10.textContent = `${stats.x10} (${getPct(stats.x10)}%)`;

  // Update Progress Bars
  const pctRuined = (stats.ruined / total) * 100;
  const pctLosing = (stats.losing / total) * 100;
  const pctNeutral = (stats.neutral / total) * 100;
  const pctWinning = (stats.winning / total) * 100;

  pbEls.ruined.style.width = pctRuined + "%";
  pbEls.losing.style.width = pctLosing + "%";
  pbEls.neutral.style.width = pctNeutral + "%";
  pbEls.winning.style.width = pctWinning + "%";
}

const COLS = 40;
const ROWS = 25;

function getColor(bank) {
  if (bank <= 0) return BANK_COLORS.BLACK;
  if (bank <= 900) return BANK_COLORS.ORANGE;
  if (bank <= 1099) return BANK_COLORS.YELLOW;
  if (bank < 2000) return BANK_COLORS.GREEN_NORMAL;
  if (bank < 3000) return BANK_COLORS.GREEN_HIGHLIGHT; // >= 2000
  if (bank < 5000) return BANK_COLORS.BLUE; // >= 3000
  if (bank < 10000) return BANK_COLORS.RED; // >= 5000
  return BANK_COLORS.FUCHSIA; // >= 10000
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cellWidth = canvas.width / COLS;
  const cellHeight = canvas.height / ROWS;
  const padding = 1;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const x = col * cellWidth;
    const y = row * cellHeight;

    // Force black immediately if ruined, otherwise use visualBank
    if (p.bank <= 0) {
      ctx.fillStyle = BANK_COLORS.BLACK;
    } else {
      ctx.fillStyle = getColor(p.visualBank);
    }

    ctx.fillRect(
      x + padding,
      y + padding,
      Math.max(0, cellWidth - padding * 2),
      Math.max(0, cellHeight - padding * 2),
    );
  }
}

function resizeCanvas() {
  const parent = canvas.parentElement;
  if (parent.clientWidth > 0 && parent.clientHeight > 0) {
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    draw();
  }
}

// Interaction
function handleInteraction(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  const cellWidth = canvas.width / COLS;
  const cellHeight = canvas.height / ROWS;

  const col = Math.floor(mouseX / cellWidth);
  const row = Math.floor(mouseY / cellHeight);
  const index = row * COLS + col;

  if (index >= 0 && index < players.length) {
    const p = players[index];
    tooltip.style.display = "block";

    let tooltipX = clientX + 15;
    let tooltipY = clientY + 15;

    if (tooltipX + 150 > window.innerWidth) tooltipX = clientX - 160;
    if (tooltipY + 100 > window.innerHeight) tooltipY = clientY - 110;

    tooltip.style.left = tooltipX + "px";
    tooltip.style.top = tooltipY + "px";

    tooltip.textContent = "";
    const title = document.createElement("strong");
    title.style.color = "var(--accent-color)";
    title.textContent = `Agente #${p.id}`;
    tooltip.appendChild(title);
    tooltip.appendChild(document.createElement("br"));
    tooltip.appendChild(document.createTextNode(`Banca: ${p.bank}€`));
    if (p.bank <= 0) {
      tooltip.appendChild(document.createElement("br"));
      const ruinedSpan = document.createElement("span");
      ruinedSpan.style.color = "var(--danger-color)";
      ruinedSpan.textContent = `Arruinado (Ronda ${p.ruinedAt})`;
      tooltip.appendChild(ruinedSpan);
    }
  } else {
    tooltip.style.display = "none";
  }
}

canvas.addEventListener("mousemove", (e) =>
  handleInteraction(e.clientX, e.clientY),
);
canvas.addEventListener("click", (e) =>
  handleInteraction(e.clientX, e.clientY),
);
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 0)
      handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
  },
  { passive: true },
);
canvas.addEventListener("mouseleave", () => (tooltip.style.display = "none"));

// Controls
playPauseBtn.addEventListener("click", toggleGame);
resetBtn.addEventListener("click", resetGame);

// Slider
speedSlider.addEventListener("input", (e) => {
  simulationSpeed = parseInt(e.target.value, 10);
});

// Stats Scroll / Navigation
statsBtn.addEventListener("click", () => {
  if (isPlaying) toggleGame();

  const dataToSave = {
    history: trackedHistory,
    rounds: matchCount,
    ids: TRACKED_PLAYER_IDS,
  };
  try {
    localStorage.setItem("seguimientoData", JSON.stringify(dataToSave));
    window.location.href = "seguimiento.html?from=index.html";
  } catch (e) {
    console.error("Error saving stats:", e);
    alert("Error al guardar datos de seguimiento.");
  }
});

window.addEventListener("resize", resizeCanvas);

// Init
initGame();
setTimeout(resizeCanvas, 50);
