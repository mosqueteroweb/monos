// Constants
const BANK_COLORS = {
    BLACK: '#000000', // Ruined
    ORANGE: '#ff9800', // Losing (<900)
    YELLOW: '#ffeb3b', // Neutral (901-1099)
    GREEN_NORMAL: '#4caf50', // Winning (>1100)
    GREEN_HIGHLIGHT: '#00e676', // x2
    BLUE: '#2196f3', // x3
    RED: '#f44336', // x5
    FUCHSIA: '#ff00ff' // x10
};

// State
let localPlayers = []; // { id, bank, visualBank, active, ruinedAt }
let matchCount = 0;
let isPlaying = false;
let animationId;
let lastUITime = 0;

// Worker
const worker = new Worker('worker.js');

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playPauseBtn = document.getElementById('playPauseBtn');
const resetBtn = document.getElementById('resetBtn');
const statsBtn = document.getElementById('statsBtn');
const speedSlider = document.getElementById('speedSlider');
const matchCountEl = document.getElementById('matchCount');
const totalMoneyEl = document.getElementById('totalMoney');
const tooltip = document.getElementById('tooltip');

// Icons
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

// Stats Elements
const statEls = {
    ruined: document.getElementById('stat-ruined'),
    losing: document.getElementById('stat-losing'),
    neutral: document.getElementById('stat-neutral'),
    winning: document.getElementById('stat-winning'),
    x2: document.getElementById('stat-x2'),
    x3: document.getElementById('stat-x3'),
    x5: document.getElementById('stat-x5'),
    x10: document.getElementById('stat-x10')
};

// Progress Bars
const pbEls = {
    ruined: document.getElementById('pb-ruined'),
    losing: document.getElementById('pb-losing'),
    neutral: document.getElementById('pb-neutral'),
    winning: document.getElementById('pb-winning')
};

// Worker Message Handling
worker.onmessage = function(e) {
    const data = e.data;
    if (data.type === 'UPDATE') {
        matchCount = data.matchCount;
        updateLocalPlayers(data.players);

        const now = performance.now();
        if (now - lastUITime > 66) {
            updateUI();
            lastUITime = now;
        }
    } else if (data.type === 'HISTORY') {
        // Save history and navigate
        const dataToSave = {
            history: data.history,
            rounds: data.rounds,
            ids: data.ids
        };
        try {
            localStorage.setItem('seguimientoData', JSON.stringify(dataToSave));
            window.location.href = 'seguimiento.html';
        } catch (err) {
            console.error("Error saving stats:", err);
            alert("Error al guardar datos de seguimiento.");
        }
    }
};

function updateLocalPlayers(workerPlayers) {
    if (localPlayers.length === 0) {
        // Initialize
        localPlayers = workerPlayers.map(p => ({
            id: p.id,
            bank: p.bank,
            visualBank: p.bank,
            active: p.active,
            ruinedAt: p.ruinedAt,
            maxBank: p.maxBank
        }));
    } else {
        // Update existing
        for (let i = 0; i < localPlayers.length; i++) {
            const wp = workerPlayers[i];
            const lp = localPlayers[i];
            lp.bank = wp.bank;
            lp.active = wp.active;
            lp.ruinedAt = wp.ruinedAt;
            lp.maxBank = wp.maxBank;
        }
    }
}

function toggleGame() {
    isPlaying = !isPlaying;
    if (isPlaying) {
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
        playPauseBtn.classList.add('active');
        worker.postMessage({ type: 'START' });
    } else {
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
        playPauseBtn.classList.remove('active');
        worker.postMessage({ type: 'STOP' });
    }
}

function resetGame() {
    isPlaying = false;
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    playPauseBtn.classList.remove('active');
    worker.postMessage({ type: 'RESET' });

    // Reset local visual state immediately
    matchCount = 0;
    matchCountEl.textContent = '0';
    localPlayers = []; // Force re-initialization on next update for instant reset
}

// Animation Loop for Smooth Rendering
function renderLoop() {
    // Interpolation
    for (let i = 0; i < localPlayers.length; i++) {
        const p = localPlayers[i];
        p.visualBank += (p.bank - p.visualBank) * 0.1;
    }

    draw();
    requestAnimationFrame(renderLoop);
}

function updateUI() {
    matchCountEl.textContent = matchCount.toLocaleString();

    let stats = {
        ruined: 0,
        losing: 0,
        neutral: 0,
        winning: 0,
        x2: 0,
        x3: 0,
        x5: 0,
        x10: 0
    };

    let totalMoney = 0;

    for (const p of localPlayers) {
        totalMoney += p.bank;
        if (p.bank <= 0) stats.ruined++;
        else if (p.bank <= 900) stats.losing++;
        else if (p.bank <= 1099) stats.neutral++;
        else stats.winning++;

        if (p.bank >= 2000) stats.x2++;
        if (p.bank >= 3000) stats.x3++;
        if (p.bank >= 5000) stats.x5++;
        if (p.bank >= 10000) stats.x10++;
    }

    totalMoneyEl.textContent = totalMoney.toLocaleString() + '€';

    const total = localPlayers.length || 1; // Avoid division by zero

    const getPct = (val) => Math.round((val / total) * 100);

    statEls.ruined.textContent = `${stats.ruined} (${getPct(stats.ruined)}%)`;
    statEls.losing.textContent = `${stats.losing} (${getPct(stats.losing)}%)`;
    statEls.neutral.textContent = `${stats.neutral} (${getPct(stats.neutral)}%)`;
    statEls.winning.textContent = `${stats.winning} (${getPct(stats.winning)}%)`;
    statEls.x2.textContent = `${stats.x2} (${getPct(stats.x2)}%)`;
    statEls.x3.textContent = `${stats.x3} (${getPct(stats.x3)}%)`;
    statEls.x5.textContent = `${stats.x5} (${getPct(stats.x5)}%)`;
    statEls.x10.textContent = `${stats.x10} (${getPct(stats.x10)}%)`;

    const pctRuined = (stats.ruined / total) * 100;
    const pctLosing = (stats.losing / total) * 100;
    const pctNeutral = (stats.neutral / total) * 100;
    const pctWinning = (stats.winning / total) * 100;

    pbEls.ruined.style.width = pctRuined + '%';
    pbEls.losing.style.width = pctLosing + '%';
    pbEls.neutral.style.width = pctNeutral + '%';
    pbEls.winning.style.width = pctWinning + '%';
}

const COLS = 40;
const ROWS = 25;

function getColor(bank) {
    if (bank <= 0) return BANK_COLORS.BLACK;
    if (bank <= 900) return BANK_COLORS.ORANGE;
    if (bank <= 1099) return BANK_COLORS.YELLOW;
    if (bank < 2000) return BANK_COLORS.GREEN_NORMAL;
    if (bank < 3000) return BANK_COLORS.GREEN_HIGHLIGHT;
    if (bank < 5000) return BANK_COLORS.BLUE;
    if (bank < 10000) return BANK_COLORS.RED;
    return BANK_COLORS.FUCHSIA;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cellWidth = canvas.width / COLS;
    const cellHeight = canvas.height / ROWS;
    const padding = 1;

    for (let i = 0; i < localPlayers.length; i++) {
        const p = localPlayers[i];
        const col = i % COLS;
        const row = Math.floor(i / COLS);

        const x = col * cellWidth;
        const y = row * cellHeight;

        if (p.bank <= 0) {
            ctx.fillStyle = BANK_COLORS.BLACK;
        } else {
            ctx.fillStyle = getColor(p.visualBank);
        }

        ctx.fillRect(x + padding, y + padding, Math.max(0, cellWidth - padding * 2), Math.max(0, cellHeight - padding * 2));
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

    if (index >= 0 && index < localPlayers.length) {
        const p = localPlayers[index];
        tooltip.style.display = 'block';

        let tooltipX = clientX + 15;
        let tooltipY = clientY + 15;

        if (tooltipX + 150 > window.innerWidth) tooltipX = clientX - 160;
        if (tooltipY + 100 > window.innerHeight) tooltipY = clientY - 110;

        tooltip.style.left = tooltipX + 'px';
        tooltip.style.top = tooltipY + 'px';

        tooltip.innerHTML = `
            <strong style="color:var(--accent-color)">Agente #${p.id}</strong><br>
            Banca: ${p.bank}€<br>
            ${p.bank <= 0 ? `<span style='color:var(--danger-color)'>Arruinado (Ronda ${p.ruinedAt})</span>` : ''}
        `;
    } else {
        tooltip.style.display = 'none';
    }
}

canvas.addEventListener('mousemove', (e) => handleInteraction(e.clientX, e.clientY));
canvas.addEventListener('click', (e) => handleInteraction(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
}, {passive: true});
canvas.addEventListener('mouseleave', () => tooltip.style.display = 'none');

// Controls
playPauseBtn.addEventListener('click', toggleGame);
resetBtn.addEventListener('click', resetGame);

// Slider
speedSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    worker.postMessage({ type: 'SPEED', value: val });
});

// Stats
statsBtn.addEventListener('click', () => {
    if (isPlaying) toggleGame(); // Pause
    worker.postMessage({ type: 'GET_HISTORY' });
});

window.addEventListener('resize', resizeCanvas);

// Init
worker.postMessage({ type: 'INIT' });
setTimeout(resizeCanvas, 50);
requestAnimationFrame(renderLoop);
