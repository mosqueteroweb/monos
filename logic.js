// logic.js - Shared logic for Battle Royale simulation

// Constants
const INITIAL_BANK = 1000;
const BET_AMOUNT = 1;
const PLAYER_COUNT = 1000;
const TRACKED_PLAYER_IDS = [500, 334, 23, 765];
const MAX_TRACKED_ROUNDS = 100000;

const THRESHOLDS = {
    RUINED: 0,
    LOSING: 900,
    NEUTRAL: 1099,
    X2: 2000,
    X3: 3000,
    X5: 5000,
    X10: 10000
};

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

/**
 * Returns the color associated with a player's bank balance.
 * @param {number} bank
 * @returns {string} Hex color
 */
function getColor(bank) {
    if (bank <= THRESHOLDS.RUINED) return BANK_COLORS.BLACK;
    if (bank <= THRESHOLDS.LOSING) return BANK_COLORS.ORANGE;
    if (bank <= THRESHOLDS.NEUTRAL) return BANK_COLORS.YELLOW;
    if (bank < THRESHOLDS.X2) return BANK_COLORS.GREEN_NORMAL;
    if (bank < THRESHOLDS.X3) return BANK_COLORS.GREEN_HIGHLIGHT;
    if (bank < THRESHOLDS.X5) return BANK_COLORS.BLUE;
    if (bank < THRESHOLDS.X10) return BANK_COLORS.RED;
    return BANK_COLORS.FUCHSIA;
}

class SecureBatchRNG {
    constructor(cryptoImpl) {
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

        // Determine crypto implementation
        if (cryptoImpl) {
            this.crypto = cryptoImpl;
        } else if (typeof crypto !== 'undefined') {
             this.crypto = crypto;
        } else if (typeof window !== 'undefined' && window.crypto) {
             this.crypto = window.crypto;
        } else if (typeof self !== 'undefined' && self.crypto) {
             this.crypto = self.crypto;
        }
    }

    refill() {
        if (!this.crypto) {
             // Fallback or error if crypto not available
             // For tests we might mock it via constructor or property injection
             return;
        }
        for (let i = 0; i < this.views.length; i++) {
            this.crypto.getRandomValues(this.views[i]);
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

class Player {
    constructor(id) {
        this.id = id;
        this.bank = INITIAL_BANK;
        this.visualBank = INITIAL_BANK; // Smooth transitions
        this.active = true;
        this.maxBank = INITIAL_BANK;
        this.ruinedAt = null;
    }

    play(coinSide, rng, currentMatchCount) {
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
                this.ruinedAt = currentMatchCount;
            }
        }
    }
}

/**
 * Synchronizes local player state with data from the worker.
 * @param {Array} workerPlayers - Data from worker
 * @param {Array} localPlayers - Current local state
 * @returns {Array} Updated local players
 */
function updateLocalPlayers(workerPlayers, localPlayers) {
    if (!localPlayers || localPlayers.length === 0) {
        // Initialize
        return workerPlayers.map(p => ({
            id: p.id,
            bank: p.bank,
            visualBank: p.bank,
            active: p.active,
            ruinedAt: p.ruinedAt,
            maxBank: p.maxBank
        }));
    } else {
        // Update existing (mutates the objects in place for performance in render loop)
        for (let i = 0; i < localPlayers.length; i++) {
            const wp = workerPlayers[i];
            const lp = localPlayers[i];
            if (wp && lp) {
                lp.bank = wp.bank;
                lp.active = wp.active;
                lp.ruinedAt = wp.ruinedAt;
                lp.maxBank = wp.maxBank;
            }
        }
        return localPlayers;
    }
}

// Export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        INITIAL_BANK,
        BET_AMOUNT,
        PLAYER_COUNT,
        TRACKED_PLAYER_IDS,
        MAX_TRACKED_ROUNDS,
        THRESHOLDS,
        BANK_COLORS,
        getColor,
        updateLocalPlayers,
        SecureBatchRNG,
        Player
    };
}
