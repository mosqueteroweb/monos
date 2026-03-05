
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- Mocking ---

// Mock Console to capture logs/errors if needed
// const console = { ...global.console };

// Mock DOM Elements
class Element {
    constructor(id) {
        this.id = id;
        this.textContent = '';
        this.value = '';
        this.style = {};
        this.classList = {
            add: () => {},
            remove: () => {},
            contains: () => false,
            toggle: () => {},
        };
        this.addEventListener = () => {};
        this.innerHTML = '';
        this.clientWidth = 800;
        this.clientHeight = 600;
        this.parentElement = { clientWidth: 800, clientHeight: 600 };
    }
    getContext(type) {
        if (type === '2d') {
            return {
                clearRect: () => {},
                fillRect: () => {},
                fillStyle: '',
                width: 800,
                height: 600,
            };
        }
        return null;
    }
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 800, height: 600 };
    }
}

const mockDocument = {
    getElementById: (id) => new Element(id),
    body: new Element('body'),
    addEventListener: () => {},
};

// Mock Window & RequestAnimationFrame
let time = 0;
let animationCallbacks = [];

const mockWindow = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    requestAnimationFrame: (cb) => {
        const id = animationCallbacks.length;
        animationCallbacks.push(cb);
        return id;
    },
    cancelAnimationFrame: (id) => {
        // Simple implementation: prevent callback from running
        // For simplicity, we can just clear the queue in step() if needed,
        // but here we just ignore cancel for the benchmark flow.
    },
    document: mockDocument,
    Math: Math,
    console: console,
    performance: {
        now: () => time,
    }
};

// Mock RNG (Crypto)
const mockCrypto = {
    getRandomValues: (array) => {
        // Fill with random bytes efficiently for benchmark
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }
};

const mockWindowWithCrypto = {
    ...mockWindow,
    crypto: mockCrypto
};

// --- Execution Helper ---

function runBenchmark() {
    console.log('--- Running UI Throttling Benchmark ---');

    const gamePath = path.join(__dirname, '..', 'game.js');
    let scriptCode = fs.readFileSync(gamePath, 'utf8');

    // Remove `window.` prefix usage if any, to simplify scope management
    scriptCode = scriptCode.replace(/window\./g, '');

    // We need to inject our mocks.
    const context = {
        window: mockWindowWithCrypto,
        crypto: mockCrypto,
        innerWidth: mockWindow.innerWidth,
        innerHeight: mockWindow.innerHeight,
        location: { href: '' },
        addEventListener: mockWindow.addEventListener,
        document: mockDocument,
        console: console,
        requestAnimationFrame: mockWindow.requestAnimationFrame,
        cancelAnimationFrame: mockWindow.cancelAnimationFrame,
        performance: mockWindow.performance,
        // rng: mockRng, // Script now defines its own rng using SecureBatchRNG
        // Global constructors used in script
        Math: Math,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
    };

    vm.createContext(context);

    // Execute the script to initialize variables and functions
    try {
        vm.runInContext(scriptCode, context);
    } catch (e) {
        console.error('Error running script:', e);
        process.exit(1);
    }

    // Now we can access functions and variables from context
    // We want to count calls to updateUI.
    // Since `updateUI` is defined inside the script scope, we can access it via context if it's global?
    // No, `const` and `function` declarations in top level scope of script are not properties of global object in strict mode or module,
    // but in standard script they become properties of global object (window).
    // Let's assume standard script behavior.

    // Spy on updateUI
    let updateUICount = 0;
    const originalUpdateUI = context.updateUI;
    context.updateUI = function() {
        updateUICount++;
        // return originalUpdateUI.apply(this, arguments); // Don't actually run it to save time? Or run it to be accurate?
        // Let's run it, but mock DOM operations are fast.
        if (originalUpdateUI) originalUpdateUI.apply(this, arguments);
    };

    // Spy on draw
    let drawCount = 0;
    const originalDraw = context.draw;
    context.draw = function() {
        drawCount++;
        if (originalDraw) originalDraw.apply(this, arguments);
    };

    // Start Game Loop
    // The script calls initGame() at the end, which sets up state.
    // We need to ensure `isPlaying` is true to run the loop.

    // Check if `toggleGame` exists
    if (typeof context.toggleGame === 'function') {
        // Toggle game to start playing (it sets isPlaying = true and calls gameLoop)
        // Note: The script initializes with isPlaying = false.
        context.toggleGame();
    } else {
        console.error('toggleGame not found');
    }

    // Simulate 60 frames (1 second)
    const totalFrames = 60;
    const msPerFrame = 1000 / 60;

    console.log(`Simulating ${totalFrames} frames...`);

    for (let i = 0; i < totalFrames; i++) {
        // Advance time
        time += msPerFrame;

        // Process animation frame callbacks
        // We take the current queue and clear it, to simulate browser event loop
        const callbacks = [...animationCallbacks];
        animationCallbacks = []; // Reset for next frame

        for (const cb of callbacks) {
            cb(time); // Call with timestamp
        }
    }

    console.log(`Result over ~1000ms:`);
    console.log(`- updateUI calls: ${updateUICount}`);
    console.log(`- draw calls:     ${drawCount}`);

    // Verification Logic
    // For baseline: expect ~60 calls.
    // For optimized: expect ~15 calls.

    return { updateUICount, drawCount };
}

runBenchmark();
