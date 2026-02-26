const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

// Read ui.js
const uiPath = path.join(__dirname, '..', 'ui.js');
const uiContent = fs.readFileSync(uiPath, 'utf8');

// Extract calculateStats function
// Matches function calculateStats(players) { ... }
const calculateStatsMatch = uiContent.match(/function calculateStats\(players\) \{[\s\S]*?\n\}/);

if (!calculateStatsMatch) {
    throw new Error('Could not find calculateStats function in ui.js');
}

const calculateStatsSource = calculateStatsMatch[0];

// Create callable function
const calculateStats = new Function('players', `
    ${calculateStatsSource}
    return calculateStats(players);
`);

test('calculateStats Unit Tests', async (t) => {
    await t.test('should return zero stats for empty player list', () => {
        const stats = calculateStats([]);
        assert.strictEqual(stats.ruined, 0);
        assert.strictEqual(stats.losing, 0);
        assert.strictEqual(stats.neutral, 0);
        assert.strictEqual(stats.winning, 0);
        assert.strictEqual(stats.x2, 0);
        assert.strictEqual(stats.x3, 0);
        assert.strictEqual(stats.x5, 0);
        assert.strictEqual(stats.x10, 0);
        assert.strictEqual(stats.totalMoney, 0);
    });

    await t.test('should correctly categorize ruined players', () => {
        const players = [{ bank: 0 }, { bank: -10 }];
        const stats = calculateStats(players);
        assert.strictEqual(stats.ruined, 2);
        assert.strictEqual(stats.losing, 0);
        assert.strictEqual(stats.neutral, 0);
        assert.strictEqual(stats.winning, 0);
        assert.strictEqual(stats.totalMoney, -10);
    });

    await t.test('should correctly categorize losing players (1-900)', () => {
        const players = [{ bank: 1 }, { bank: 500 }, { bank: 900 }];
        const stats = calculateStats(players);
        assert.strictEqual(stats.losing, 3);
        assert.strictEqual(stats.ruined, 0);
        assert.strictEqual(stats.neutral, 0);
        assert.strictEqual(stats.winning, 0);
    });

    await t.test('should correctly categorize neutral players (901-1099)', () => {
        const players = [{ bank: 901 }, { bank: 1000 }, { bank: 1099 }];
        const stats = calculateStats(players);
        assert.strictEqual(stats.neutral, 3);
        assert.strictEqual(stats.losing, 0);
        assert.strictEqual(stats.winning, 0);
    });

    await t.test('should correctly categorize winning players (>=1100)', () => {
        const players = [{ bank: 1100 }, { bank: 1500 }];
        const stats = calculateStats(players);
        assert.strictEqual(stats.winning, 2);
    });

    await t.test('should correctly calculate multipliers', () => {
        const players = [
            { bank: 2000 }, // x2
            { bank: 3000 }, // x3 (and x2)
            { bank: 5000 }, // x5 (and x3, x2)
            { bank: 10000 } // x10 (and x5, x3, x2)
        ];
        const stats = calculateStats(players);

        assert.strictEqual(stats.x2, 4); // All >= 2000
        assert.strictEqual(stats.x3, 3); // All >= 3000
        assert.strictEqual(stats.x5, 2); // All >= 5000
        assert.strictEqual(stats.x10, 1); // All >= 10000
    });

    await t.test('should calculate correct total money', () => {
        const players = [
            { bank: 100 },
            { bank: 200 },
            { bank: -50 }
        ];
        const stats = calculateStats(players);
        assert.strictEqual(stats.totalMoney, 250);
    });
});
