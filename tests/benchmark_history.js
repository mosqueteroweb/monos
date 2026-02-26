const { performance } = require('perf_hooks');

const MAX_TRACKED_ROUNDS = 100000;
const TRACKED_PLAYER_IDS = [500, 334, 23, 765];
const PLAYER_COUNT = 1000;
const ITERATIONS = 100; // Run the test multiple times to get average

// Mock players
const players = [];
for (let i = 0; i < PLAYER_COUNT; i++) {
    players.push({ bank: 1000 });
}

function benchmarkArrayPush() {
    const trackedHistory = {};
    TRACKED_PLAYER_IDS.forEach(id => {
        trackedHistory[id] = [1000];
    });

    const start = performance.now();
    for (let match = 1; match <= MAX_TRACKED_ROUNDS; match++) {
        for (const id of TRACKED_PLAYER_IDS) {
            trackedHistory[id].push(players[id].bank);
        }
    }
    const end = performance.now();
    return end - start;
}

function benchmarkInt32Array() {
    const trackedHistory = {};
    TRACKED_PLAYER_IDS.forEach(id => {
        trackedHistory[id] = new Int32Array(MAX_TRACKED_ROUNDS + 1);
        trackedHistory[id][0] = 1000;
    });
    let historyIndex = 1;

    const start = performance.now();
    for (let match = 1; match <= MAX_TRACKED_ROUNDS; match++) {
        if (historyIndex <= MAX_TRACKED_ROUNDS) {
            for (const id of TRACKED_PLAYER_IDS) {
                trackedHistory[id][historyIndex] = players[id].bank;
            }
            historyIndex++;
        }
    }
    const end = performance.now();
    return end - start;
}

console.log(`Running benchmark with ${MAX_TRACKED_ROUNDS} rounds over ${ITERATIONS} iterations...`);

let totalPushTime = 0;
let totalInt32Time = 0;

// Warmup
benchmarkArrayPush();
benchmarkInt32Array();

for (let i = 0; i < ITERATIONS; i++) {
    totalPushTime += benchmarkArrayPush();
    totalInt32Time += benchmarkInt32Array();
}

const avgPush = totalPushTime / ITERATIONS;
const avgInt32 = totalInt32Time / ITERATIONS;

console.log(`Average Time (Array.push): ${avgPush.toFixed(3)}ms`);
console.log(`Average Time (Int32Array): ${avgInt32.toFixed(3)}ms`);
console.log(`Improvement: ${((avgPush - avgInt32) / avgPush * 100).toFixed(2)}%`);
