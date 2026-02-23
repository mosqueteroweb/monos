// Constants
const INITIAL_BANK = 1000;
const BET_AMOUNT = 1;
const PLAYER_COUNT = 1000;
const TRACKED_PLAYER_IDS = [500, 334, 23, 765];
const MAX_TRACKED_ROUNDS = 100000;

// State
let players = [];
let matchCount = 0;
let isPlaying = false;
let simulationSpeed = 1000;
let trackedHistory = {};
let intervalId = null;

// RNG
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
            self.crypto.getRandomValues(this.views[i]);
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
        this.active = true;
        this.maxBank = INITIAL_BANK;
        this.ruinedAt = null;
    }

    play(coinSide) {
        if (!this.active) return;

        // rng is global in this scope
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

    rng.refill();

    // Run simulation steps
    for (let i = 0; i < simulationSpeed; i++) {
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
