// Mide cuánto tarda un tick a velocidad máxima: node tests/benchmark.js
const { webcrypto } = require("node:crypto");

globalThis.crypto ??= webcrypto;
const { Simulation } = require("../sim.js");

const ROUNDS = 10000;
const RUNS = 5;

const sim = new Simulation();
const times = [];
for (let run = 0; run < RUNS; run++) {
  sim.reset();
  const start = performance.now();
  sim.step(ROUNDS);
  times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
console.log(
  `${ROUNDS} rondas × ${sim.banks.length} jugadores: mediana ${times[RUNS >> 1].toFixed(1)} ms`,
);
