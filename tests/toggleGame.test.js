const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

/**
 * Robustly extract a function from a source string by counting balanced braces.
 */
function extractFunction(source, functionName) {
    const regex = new RegExp(`function\\s+${functionName}\\s*\\(.*?\\)\\s*\\{`);
    const match = source.match(regex);
    if (!match) return null;

    const startIndex = match.index;
    const bodyStartIndex = startIndex + match[0].length - 1; // index of '{'

    let braceCount = 0;
    let i = bodyStartIndex;
    while (i < source.length) {
        if (source[i] === '{') braceCount++;
        else if (source[i] === '}') braceCount--;

        if (braceCount === 0) {
            return source.substring(startIndex, i + 1);
        }
        i++;
    }
    return null;
}

// Read game.js
const gamePath = path.join(__dirname, '..', 'game.js');
const gameContent = fs.readFileSync(gamePath, 'utf8');

// Extract toggleGame function
const toggleGameSource = extractFunction(gameContent, 'toggleGame');

if (!toggleGameSource) {
    throw new Error('Could not find toggleGame function in game.js');
}

function createMockElement() {
    return {
        classList: {
            classes: new Set(),
            add(cls) { this.classes.add(cls); },
            remove(cls) { this.classes.delete(cls); },
            contains(cls) { return this.classes.has(cls); }
        }
    };
}

test('toggleGame Unit Tests', async (t) => {
    await t.test('should start the game when isPlaying is false', () => {
        // Setup context
        const context = {
            isPlaying: false,
            animationId: null,
            iconPlay: createMockElement(),
            iconPause: createMockElement(),
            playPauseBtn: createMockElement(),
            requestAnimationFrame: (cb) => 123,
            cancelAnimationFrame: () => {},
            gameLoop: () => {}
        };

        // Create function with context
        const toggleGameWrapper = new Function('ctx', `
            let isPlaying = ctx.isPlaying;
            let animationId = ctx.animationId;
            const iconPlay = ctx.iconPlay;
            const iconPause = ctx.iconPause;
            const playPauseBtn = ctx.playPauseBtn;
            const requestAnimationFrame = ctx.requestAnimationFrame;
            const cancelAnimationFrame = ctx.cancelAnimationFrame;
            const gameLoop = ctx.gameLoop;

            ${toggleGameSource}

            toggleGame();

            ctx.isPlaying = isPlaying;
            ctx.animationId = animationId;
        `);

        toggleGameWrapper(context);

        assert.strictEqual(context.isPlaying, true);
        assert.strictEqual(context.animationId, 123);
        assert.ok(context.iconPlay.classList.contains('hidden'));
        assert.ok(!context.iconPause.classList.contains('hidden'));
        assert.ok(context.playPauseBtn.classList.contains('active'));
    });

    await t.test('should stop the game when isPlaying is true', () => {
        // Setup context
        const context = {
            isPlaying: true,
            animationId: 123,
            iconPlay: createMockElement(),
            iconPause: createMockElement(),
            playPauseBtn: createMockElement(),
            requestAnimationFrame: () => {},
            cancelAnimationFrame: (id) => { context.cancelledId = id; },
            gameLoop: () => {},
            cancelledId: null
        };
        context.iconPlay.classList.add('hidden');
        context.playPauseBtn.classList.add('active');

        // Create function with context
        const toggleGameWrapper = new Function('ctx', `
            let isPlaying = ctx.isPlaying;
            let animationId = ctx.animationId;
            const iconPlay = ctx.iconPlay;
            const iconPause = ctx.iconPause;
            const playPauseBtn = ctx.playPauseBtn;
            const requestAnimationFrame = ctx.requestAnimationFrame;
            const cancelAnimationFrame = ctx.cancelAnimationFrame;
            const gameLoop = ctx.gameLoop;

            ${toggleGameSource}

            toggleGame();

            ctx.isPlaying = isPlaying;
            ctx.animationId = animationId;
        `);

        toggleGameWrapper(context);

        assert.strictEqual(context.isPlaying, false);
        assert.strictEqual(context.cancelledId, 123);
        assert.ok(!context.iconPlay.classList.contains('hidden'));
        assert.ok(context.iconPause.classList.contains('hidden'));
        assert.ok(!context.playPauseBtn.classList.contains('active'));
    });
});
