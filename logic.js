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

const THRESHOLDS = {
    RUINED: 0,
    LOSING: 900,
    NEUTRAL: 1099, // Upper bound
    X2: 2000,
    X3: 3000,
    X5: 5000,
    X10: 10000
};

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

// Module export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BANK_COLORS, THRESHOLDS, getColor };
}
