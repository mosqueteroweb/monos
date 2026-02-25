const test = require('node:test');
const assert = require('node:assert');
const { updateLocalPlayers } = require('../logic.js');

test('updateLocalPlayers - Initialization', async (t) => {
    await t.test('should initialize localPlayers when empty', () => {
        const initialLocalPlayers = [];

        const workerPlayers = [
            { id: 0, bank: 1000, active: true, ruinedAt: null, maxBank: 1000 },
            { id: 1, bank: 950, active: true, ruinedAt: null, maxBank: 1000 }
        ];

        const result = updateLocalPlayers(workerPlayers, initialLocalPlayers);

        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].id, 0);
        assert.strictEqual(result[0].bank, 1000);
        assert.strictEqual(result[0].visualBank, 1000);
        assert.strictEqual(result[0].active, true);

        assert.strictEqual(result[1].id, 1);
        assert.strictEqual(result[1].bank, 950);
        assert.strictEqual(result[1].visualBank, 950);
        assert.strictEqual(result[1].active, true);
    });
});

test('updateLocalPlayers - Update', async (t) => {
    await t.test('should update existing localPlayers', () => {
        const initialLocalPlayers = [
            { id: 0, bank: 1000, visualBank: 1000, active: true, ruinedAt: null, maxBank: 1000 },
            { id: 1, bank: 950, visualBank: 950, active: true, ruinedAt: null, maxBank: 1000 }
        ];

        const workerPlayers = [
            { id: 0, bank: 1010, active: true, ruinedAt: null, maxBank: 1010 },
            { id: 1, bank: 0, active: false, ruinedAt: 150, maxBank: 1000 }
        ];

        const result = updateLocalPlayers(workerPlayers, initialLocalPlayers);

        assert.strictEqual(result.length, 2);

        // Player 0 update
        assert.strictEqual(result[0].bank, 1010);
        assert.strictEqual(result[0].visualBank, 1000, 'visualBank should NOT be updated by updateLocalPlayers');
        assert.strictEqual(result[0].maxBank, 1010);

        // Player 1 update
        assert.strictEqual(result[1].bank, 0);
        assert.strictEqual(result[1].visualBank, 950, 'visualBank should NOT be updated by updateLocalPlayers');
        assert.strictEqual(result[1].active, false);
        assert.strictEqual(result[1].ruinedAt, 150);
    });
});

test('updateLocalPlayers - Reset Scenario', async (t) => {
    await t.test('should re-initialize when localPlayers is cleared', () => {
        // eslint-disable-next-line prefer-const
        let localPlayers = [];

        const workerPlayers = [
            { id: 0, bank: 1000, active: true, ruinedAt: null, maxBank: 1000 }
        ];

        const result = updateLocalPlayers(workerPlayers, localPlayers);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].bank, 1000);
        assert.strictEqual(result[0].visualBank, 1000, 'visualBank should be reset to bank on re-initialization');
    });
});
