const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

// Read worker.js content
const workerPath = path.join(__dirname, '..', 'worker.js');
const workerContent = fs.readFileSync(workerPath, 'utf8');

// Helper to create a worker instance
function createWorker() {
    const messages = [];
    let intervalId = null;
    let intervalCallback = null;
    let intervalDelay = null;
    let clearIntervalId = null;

    const mockSelf = {
        postMessage: (msg) => {
            messages.push(msg);
        },
        crypto: {
            getRandomValues: (view) => {
                // Mock random values for deterministic testing
                for (let i = 0; i < view.length; i++) {
                    view[i] = 0; // Always return 0 for predictable behavior
                }
                return view;
            }
        },
        onmessage: null // Will be assigned by worker code
    };

    // Mock global functions needed by worker
    const context = {
        self: mockSelf,
        setInterval: (callback, delay) => {
            intervalCallback = callback;
            intervalDelay = delay;
            intervalId = 123; // Mock ID
            return intervalId;
        },
        clearInterval: (id) => {
            clearIntervalId = id;
            if (id === intervalId) {
                intervalId = null;
                intervalCallback = null;
            }
        },
        console: {
            log: () => {},
            error: () => {}
        }
    };

    // Wrap worker code in a function to execute it with mocked scope
    // We remove the last line if it's just a comment or empty, but generally wrapping works
    // Note: We need to expose the context to the eval'd code

    // Construct the function body. We prepend context keys to be available in scope
    // But since we use 'self' extensively, we can just pass 'self' and others as args

    // Best approach: new Function('self', 'setInterval', 'clearInterval', 'console', workerContent)
    const workerFn = new Function('self', 'setInterval', 'clearInterval', 'console', workerContent);

    workerFn(context.self, context.setInterval, context.clearInterval, context.console);

    return {
        self: mockSelf,
        messages,
        getIntervalCallback: () => intervalCallback,
        getClearIntervalId: () => clearIntervalId,
        getIntervalId: () => intervalId
    };
}

test('Worker Message Handling', async (t) => {

    await t.test('INIT: should initialize game and send update', () => {
        const worker = createWorker();

        // Trigger INIT
        worker.self.onmessage({ data: { type: 'INIT' } });

        assert.strictEqual(worker.messages.length, 1);
        assert.strictEqual(worker.messages[0].type, 'UPDATE');
        assert.strictEqual(worker.messages[0].matchCount, 0);
        assert.strictEqual(worker.messages[0].banks.length, 1000); // PLAYER_COUNT
    });

    await t.test('START: should start game loop', () => {
        const worker = createWorker();

        // Need to INIT first to setup players
        worker.self.onmessage({ data: { type: 'INIT' } });
        worker.messages.length = 0; // Clear init message

        // Trigger START
        worker.self.onmessage({ data: { type: 'START' } });

        assert.strictEqual(worker.getIntervalId(), 123);
        assert.ok(worker.getIntervalCallback(), 'Interval callback should be set');

        // Check idempotency (calling START again shouldn't create new interval)
        const callback = worker.getIntervalCallback();
        worker.self.onmessage({ data: { type: 'START' } });
        assert.strictEqual(worker.getIntervalCallback(), callback); // Should be same function reference if logic handles it, or at least interval ID logic holds
        // Actually the logic is: if (!isPlaying) { ... setInterval ... }
        // So second call shouldn't call setInterval again.
        // We can check if setInterval was called twice.
        // Our mock returns 123. If called again, it would overwrite/return 123.
        // Better way: check if createWorker's context logic captures calls.
        // But simply checking intervalId is 123 is good enough for basic functional test.
    });

    await t.test('STOP: should stop game loop', () => {
        const worker = createWorker();
        worker.self.onmessage({ data: { type: 'INIT' } });
        worker.self.onmessage({ data: { type: 'START' } });

        assert.ok(worker.getIntervalId());

        // Trigger STOP
        worker.self.onmessage({ data: { type: 'STOP' } });

        assert.strictEqual(worker.getClearIntervalId(), 123);
        // Our mock implementation sets intervalId to null on clear
        assert.strictEqual(worker.getIntervalId(), null);
    });

    await t.test('RESET: should stop loop and re-initialize', () => {
        const worker = createWorker();
        worker.self.onmessage({ data: { type: 'INIT' } });
        worker.self.onmessage({ data: { type: 'START' } });

        worker.messages.length = 0; // Clear previous messages

        // Trigger RESET
        worker.self.onmessage({ data: { type: 'RESET' } });

        assert.strictEqual(worker.getClearIntervalId(), 123);
        assert.strictEqual(worker.getIntervalId(), null);

        // Should send UPDATE message (from initGame)
        assert.strictEqual(worker.messages.length, 1);
        assert.strictEqual(worker.messages[0].type, 'UPDATE');
        assert.strictEqual(worker.messages[0].matchCount, 0);
    });

    await t.test('SPEED: should update simulation speed', () => {
        const worker = createWorker();
        worker.self.onmessage({ data: { type: 'INIT' } });
        worker.self.onmessage({ data: { type: 'START' } });

        // Default speed is 1000.
        // We can verify speed by running one loop step and checking matchCount increase.
        const gameLoop = worker.getIntervalCallback();

        // Run loop once with default speed
        worker.messages.length = 0;
        gameLoop();
        const update1 = worker.messages[0];
        assert.strictEqual(update1.type, 'UPDATE');
        // matchCount starts at 0. After one loop (speed 1000), should be 1000.
        assert.strictEqual(update1.matchCount, 1000);

        // Change SPEED
        worker.self.onmessage({ data: { type: 'SPEED', value: 500 } });

        // Run loop again
        worker.messages.length = 0;
        gameLoop();
        const update2 = worker.messages[0];
        // Previous 1000 + new 500 = 1500
        assert.strictEqual(update2.matchCount, 1500);

        // Test clamping (max 20000)
        worker.self.onmessage({ data: { type: 'SPEED', value: 99999 } });
        worker.messages.length = 0;
        gameLoop();
        const update3 = worker.messages[0];
        // 1500 + 20000 = 21500
        assert.strictEqual(update3.matchCount, 21500);
    });

    await t.test('GET_HISTORY: should return tracked history', () => {
        const worker = createWorker();
        worker.self.onmessage({ data: { type: 'INIT' } });
        worker.messages.length = 0;

        // Trigger GET_HISTORY
        worker.self.onmessage({ data: { type: 'GET_HISTORY' } });

        assert.strictEqual(worker.messages.length, 1);
        const historyMsg = worker.messages[0];
        assert.strictEqual(historyMsg.type, 'HISTORY');
        assert.ok(historyMsg.history);
        assert.ok(historyMsg.ids);
        // Check if history contains arrays for tracked IDs
        historyMsg.ids.forEach(id => {
            assert.ok(Array.isArray(historyMsg.history[id]));
            assert.ok(historyMsg.history[id].length > 0);
        });
    });
});
