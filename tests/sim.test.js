const test = require("node:test");
const assert = require("node:assert");
const { webcrypto } = require("node:crypto");

globalThis.crypto ??= webcrypto;
const MonosSim = require("../sim.js");
const { Simulation, SecureBatchRNG, colorIndex, calculateStats, COLOR } = MonosSim;

// RNG falso que devuelve siempre la misma palabra de 32 bits.
const constantRng = (word) => ({ nextWord: () => word >>> 0 });

test("SecureBatchRNG pide lotes y los recorre palabra a palabra", () => {
  let calls = 0;
  const rng = new SecureBatchRNG({
    getRandomValues(arr) {
      calls++;
      arr.fill(calls);
    },
  });
  assert.strictEqual(rng.nextWord(), 1);
  for (let i = 1; i < rng.words.length; i++) rng.nextWord();
  assert.strictEqual(calls, 1);
  assert.strictEqual(rng.nextWord(), 2);
  assert.strictEqual(calls, 2);
});

test("SecureBatchRNG no supera el límite de 65 536 bytes de getRandomValues", () => {
  const rng = new SecureBatchRNG();
  assert.ok(rng.words.byteLength <= 65536);
  rng.refill();
});

test("con todos los bits a 1 todos ganan 1 € por ronda", () => {
  const sim = new Simulation({ playerCount: 50, trackedIds: [0] }, constantRng(0xffffffff));
  sim.step(10);
  assert.ok(sim.banks.every((b) => b === 1010));
  assert.strictEqual(sim.matchCount, 10);
});

test("con todos los bits a 0 todos se arruinan en la ronda exacta", () => {
  const sim = new Simulation(
    { playerCount: 70, initialBank: 5, trackedIds: [0] },
    constantRng(0),
  );
  sim.step(100);
  assert.ok(sim.banks.every((b) => b === 0));
  assert.ok(sim.ruinedAts.every((r) => r === 5));
  assert.strictEqual(sim.activeCount, 0);
  // Sin jugadores activos no se juegan más rondas.
  assert.strictEqual(sim.matchCount, 5);
});

test("un arruinado deja de jugar y los demás siguen jugando cada ronda", () => {
  // Primera palabra: 32 derrotas (una ronda completa). Después, solo victorias.
  let words = 0;
  const rng = { nextWord: () => (words++ === 0 ? 0 : 0xffffffff) };
  const sim = new Simulation({ playerCount: 32, trackedIds: [0] }, rng);
  sim.banks[5] = 1;
  sim.step(1);
  assert.strictEqual(sim.banks[5], 0);
  assert.strictEqual(sim.ruinedAts[5], 1);
  assert.strictEqual(sim.activeCount, 31);
  assert.strictEqual(sim.banks[0], 999);
  assert.strictEqual(sim.banks[31], 999);

  sim.step(5);
  assert.strictEqual(sim.banks[5], 0);
  for (let i = 0; i < 32; i++) {
    if (i !== 5) assert.strictEqual(sim.banks[i], 1004, `jugador ${i}`);
  }
});

test("la banca nunca es negativa y cada paso cambia como mucho 1 €", () => {
  const sim = new Simulation({ playerCount: 300, initialBank: 3, trackedIds: [0] });
  let previous = sim.banks.slice();
  for (let r = 0; r < 200; r++) {
    sim.step(1);
    for (let i = 0; i < sim.banks.length; i++) {
      assert.ok(sim.banks[i] >= 0);
      assert.ok(Math.abs(sim.banks[i] - previous[i]) <= 1);
      if (previous[i] === 0) assert.strictEqual(sim.banks[i], 0);
    }
    previous = sim.banks.slice();
  }
});

test("el juego es justo: el dinero total se mantiene de media", () => {
  const sim = new Simulation({ playerCount: 2000, initialBank: 50, trackedIds: [0] });
  sim.step(2000);
  const total = sim.banks.reduce((a, b) => a + b, 0);
  // Desviación típica del total ≈ sqrt(2000 × 2000) ≈ 2000; margen de 5σ.
  assert.ok(Math.abs(total - 100000) < 10000, `total = ${total}`);
});

test("el historial cubre la partida entera con un número fijo de puntos", () => {
  const sim = new Simulation({ playerCount: 10, trackedIds: [3, 7], historyPoints: 100 });
  sim.step(12345);
  const { ids, points, history, rounds } = sim.getHistory();
  assert.deepStrictEqual(ids, [3, 7]);
  assert.strictEqual(rounds, 12345);
  assert.ok(points.length <= 101);
  assert.strictEqual(points[0], 0);
  assert.strictEqual(points[points.length - 1], 12345);
  for (let i = 1; i < points.length; i++) assert.ok(points[i] > points[i - 1]);
  assert.strictEqual(history[3].length, points.length);
  assert.strictEqual(history[3][0], 1000);
  assert.strictEqual(history[7][points.length - 1], sim.banks[7]);
});

test("reset vuelve al estado inicial", () => {
  const sim = new Simulation({ playerCount: 20, initialBank: 2, trackedIds: [0] });
  sim.step(500);
  sim.reset();
  assert.ok(sim.banks.every((b) => b === 2));
  assert.strictEqual(sim.matchCount, 0);
  assert.strictEqual(sim.activeCount, 20);
  assert.strictEqual(sim.getHistory().points.length, 1);
});

test("colorIndex respeta los umbrales del panel", () => {
  const cases = [
    [0, COLOR.RUINED],
    [1, COLOR.LOSING],
    [899, COLOR.LOSING],
    [900, COLOR.NEUTRAL],
    [1100, COLOR.NEUTRAL],
    [1101, COLOR.WINNING],
    [1999, COLOR.WINNING],
    [2000, COLOR.X2],
    [3000, COLOR.X3],
    [5000, COLOR.X5],
    [10000, COLOR.X10],
  ];
  for (const [bank, expected] of cases) assert.strictEqual(colorIndex(bank), expected, `bank ${bank}`);
});

test("calculateStats cuenta categorías y multiplicadores acumulados", () => {
  const stats = calculateStats(Int32Array.from([0, 899, 900, 1100, 1101, 2000, 3000, 5000, 10000]));
  assert.strictEqual(stats.ruined, 1);
  assert.strictEqual(stats.losing, 1);
  assert.strictEqual(stats.neutral, 2);
  assert.strictEqual(stats.winning, 5);
  assert.strictEqual(stats.x2, 4);
  assert.strictEqual(stats.x3, 3);
  assert.strictEqual(stats.x5, 2);
  assert.strictEqual(stats.x10, 1);
  assert.strictEqual(stats.totalMoney, 24000);
});
