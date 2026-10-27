const test = require("node:test");
const assert = require("node:assert");
const { webcrypto } = require("node:crypto");

globalThis.crypto ??= webcrypto;
const { createController, MAX_ROUNDS_PER_TICK } = require("../sim.js");

function setup(options) {
  const messages = [];
  const controller = createController((message) => messages.push(message), options);
  const last = (type) => messages.filter((m) => m.type === type).pop();
  return { controller, messages, last };
}

test("INIT envía el estado inicial", () => {
  const { controller, last } = setup({ playerCount: 10, trackedIds: [0] });
  controller.handle({ type: "INIT" });
  const update = last("UPDATE");
  assert.strictEqual(update.matchCount, 0);
  assert.strictEqual(update.banks.length, 10);
  assert.ok(update.banks instanceof Int32Array);
});

test("START avanza la simulación y STOP la detiene", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { controller, last } = setup({ playerCount: 10, trackedIds: [0] });
  controller.handle({ type: "SPEED", value: 100 });
  controller.handle({ type: "START" });
  assert.ok(controller.isRunning());
  t.mock.timers.tick(0);
  t.mock.timers.tick(16);
  assert.strictEqual(last("UPDATE").matchCount, 200);

  controller.handle({ type: "STOP" });
  assert.ok(!controller.isRunning());
  t.mock.timers.tick(1000);
  assert.strictEqual(last("UPDATE").matchCount, 200);
});

test("START dos veces no lanza dos bucles", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { controller, last } = setup({ playerCount: 10, trackedIds: [0] });
  controller.handle({ type: "SPEED", value: 10 });
  controller.handle({ type: "START" });
  controller.handle({ type: "START" });
  t.mock.timers.tick(0);
  assert.strictEqual(last("UPDATE").matchCount, 10);
  controller.handle({ type: "STOP" });
});

test("RESET detiene y reinicia", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { controller, last } = setup({ playerCount: 10, trackedIds: [0] });
  controller.handle({ type: "START" });
  t.mock.timers.tick(0);
  controller.handle({ type: "RESET" });
  assert.ok(!controller.isRunning());
  assert.strictEqual(last("UPDATE").matchCount, 0);
});

test("SPEED se limita a un rango válido", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { controller, last } = setup({ playerCount: 1, initialBank: 1e9, trackedIds: [0] });
  controller.handle({ type: "SPEED", value: "999999" });
  controller.handle({ type: "START" });
  t.mock.timers.tick(0);
  assert.strictEqual(last("UPDATE").matchCount, MAX_ROUNDS_PER_TICK);
  controller.handle({ type: "STOP" });

  controller.handle({ type: "RESET" });
  controller.handle({ type: "SPEED", value: "abc" });
  controller.handle({ type: "SPEED", value: -5 });
  controller.handle({ type: "START" });
  t.mock.timers.tick(0);
  assert.strictEqual(last("UPDATE").matchCount, 1);
  controller.handle({ type: "STOP" });
});

test("cuando todos se arruinan se avisa con FINISHED y se para", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { controller, last } = setup({ playerCount: 5, initialBank: 1, trackedIds: [0] });
  controller.handle({ type: "SPEED", value: 20000 });
  controller.handle({ type: "START" });
  for (let i = 0; i < 50 && controller.isRunning(); i++) t.mock.timers.tick(16);
  assert.ok(last("FINISHED"));
  assert.ok(!controller.isRunning());
});

test("GET_HISTORY devuelve el historial muestreado", () => {
  const { controller, last } = setup({ playerCount: 10, trackedIds: [2, 4] });
  controller.sim.step(50);
  controller.handle({ type: "GET_HISTORY" });
  const history = last("HISTORY");
  assert.deepStrictEqual(history.ids, [2, 4]);
  assert.strictEqual(history.rounds, 50);
  assert.strictEqual(history.points.length, 51);
  assert.strictEqual(history.history[2].length, 51);
});
