// logic.js - Shared logic for Battle Royale simulation

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
    if (bank <= 0) return BANK_COLORS.BLACK;
    if (bank <= 900) return BANK_COLORS.ORANGE;
    if (bank <= 1099) return BANK_COLORS.YELLOW;
    if (bank < 2000) return BANK_COLORS.GREEN_NORMAL;
    if (bank < 3000) return BANK_COLORS.GREEN_HIGHLIGHT;
    if (bank < 5000) return BANK_COLORS.BLUE;
    if (bank < 10000) return BANK_COLORS.RED;
    return BANK_COLORS.FUCHSIA;
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
        BANK_COLORS,
        getColor,
        updateLocalPlayers
    };
}
