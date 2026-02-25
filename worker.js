importScripts('logic.js');

// State
let players = [];
let matchCount = 0;
let isPlaying = false;
let simulationSpeed = 1000;
let trackedHistory = {};
let intervalId = null;

const rng = new SecureBatchRNG();

function initGame() {
    players = [];
    matchCount = 0;
    trackedHistory = {};
    TRACKED_PLAYER_IDS.forEach(id => {
        trackedHistory[id] = [INITIAL_BANK];
    });

    rng.refill();
    for (let i = 0; i < PLAYER_COUNT; i++) {
        players.push(new Player(i));
    }

    sendUpdate();
}

function gameLoop() {
    if (!isPlaying) return;

    // Run simulation steps
    for (let i = 0; i < simulationSpeed; i++) {
        matchCount++;
        const coinSide = rng.getBit();
        for (let j = 0; j < PLAYER_COUNT; j++) {
            players[j].play(coinSide, rng, matchCount);
        }

        if (matchCount <= MAX_TRACKED_ROUNDS) {
            for (const id of TRACKED_PLAYER_IDS) {
                trackedHistory[id].push(players[id].bank);
            }
        }
    }

    sendUpdate();
}

function sendUpdate() {
    // We send a simplified state to minimize overhead.
    // We do NOT send trackedHistory every frame to avoid huge message sizes.
    self.postMessage({
        type: 'UPDATE',
        players: players,
        matchCount: matchCount
    });
}

// Message Handler
self.onmessage = function(e) {
    const data = e.data;
    switch (data.type) {
        case 'INIT':
            initGame();
            break;
        case 'GET_HISTORY':
            self.postMessage({
                type: 'HISTORY',
                history: trackedHistory,
                rounds: matchCount,
                ids: TRACKED_PLAYER_IDS
            });
            break;
        case 'START':
            if (!isPlaying) {
                isPlaying = true;
                // Run loop approximately at 60fps
                intervalId = setInterval(gameLoop, 16);
            }
            break;
        case 'STOP':
            isPlaying = false;
            if (intervalId) clearInterval(intervalId);
            break;
        case 'RESET':
            isPlaying = false;
            if (intervalId) clearInterval(intervalId);
            initGame();
            break;
        case 'SPEED':
            simulationSpeed = data.value;
            break;
    }
};
