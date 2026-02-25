const test = require('node:test');
const assert = require('node:assert');
const Logic = require('../logic.js');

test('Logic Module Exports', async (t) => {
    await t.test('should export constants', () => {
        assert.ok(typeof Logic.INITIAL_BANK === 'number');
        assert.ok(typeof Logic.BET_AMOUNT === 'number');
        assert.ok(typeof Logic.PLAYER_COUNT === 'number');
        assert.ok(Array.isArray(Logic.TRACKED_PLAYER_IDS));
        assert.ok(typeof Logic.MAX_TRACKED_ROUNDS === 'number');
        assert.ok(typeof Logic.THRESHOLDS === 'object');
        assert.ok(typeof Logic.BANK_COLORS === 'object');
    });

    await t.test('should export functions', () => {
        assert.ok(typeof Logic.getColor === 'function');
        assert.ok(typeof Logic.updateLocalPlayers === 'function');
    });

    await t.test('should export classes', () => {
        assert.ok(typeof Logic.SecureBatchRNG === 'function');
        assert.ok(typeof Logic.Player === 'function');
    });

    await t.test('Player class should be instantiable', () => {
        const player = new Logic.Player(1);
        assert.strictEqual(player.id, 1);
        assert.strictEqual(player.bank, Logic.INITIAL_BANK);
    });

    await t.test('SecureBatchRNG class should be instantiable with mock crypto', () => {
        const mockCrypto = { getRandomValues: () => {} };
        const rng = new Logic.SecureBatchRNG(mockCrypto);
        assert.ok(rng.buffer);
    });
});
