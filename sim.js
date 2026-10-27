/**
 * Núcleo de la simulación, compartido por el Web Worker, el modo sin Worker
 * (página abierta con file://) y los tests de Node.
 *
 * Cada jugador elige cara o cruz al azar contra una moneda única. Como la
 * elección es independiente y 50/50, acertar es también un 50/50 independiente
 * por jugador: basta un bit aleatorio por apuesta, sin lanzar la moneda.
 */
(function (global) {
  const DEFAULTS = {
    playerCount: 1000,
    initialBank: 1000,
    trackedIds: [500, 334, 23, 765],
    historyPoints: 2000,
  };

  const MAX_ROUNDS_PER_TICK = 20000;
  const TICK_MS = 16;

  // Umbrales de cada categoría. Una sola fuente para colores, panel y tests.
  const LOSING_BELOW = 900;
  const WINNING_ABOVE = 1100;
  const MULTIPLIERS = [
    { key: "x2", min: 2000 },
    { key: "x3", min: 3000 },
    { key: "x5", min: 5000 },
    { key: "x10", min: 10000 },
  ];

  // Índices de color, de peor a mejor.
  const COLOR = {
    RUINED: 0,
    LOSING: 1,
    NEUTRAL: 2,
    WINNING: 3,
    X2: 4,
    X3: 5,
    X5: 6,
    X10: 7,
  };

  function colorIndex(bank) {
    if (bank <= 0) return COLOR.RUINED;
    if (bank < LOSING_BELOW) return COLOR.LOSING;
    if (bank <= WINNING_ABOVE) return COLOR.NEUTRAL;
    if (bank < 2000) return COLOR.WINNING;
    if (bank < 3000) return COLOR.X2;
    if (bank < 5000) return COLOR.X3;
    if (bank < 10000) return COLOR.X5;
    return COLOR.X10;
  }

  function calculateStats(banks) {
    const stats = {
      ruined: 0,
      losing: 0,
      neutral: 0,
      winning: 0,
      x2: 0,
      x3: 0,
      x5: 0,
      x10: 0,
      totalMoney: 0,
    };
    for (let i = 0; i < banks.length; i++) {
      const bank = banks[i];
      stats.totalMoney += bank;
      if (bank <= 0) stats.ruined++;
      else if (bank < LOSING_BELOW) stats.losing++;
      else if (bank <= WINNING_ABOVE) stats.neutral++;
      else stats.winning++;
      for (const m of MULTIPLIERS) {
        if (bank >= m.min) stats[m.key]++;
      }
    }
    return stats;
  }

  /** Bits aleatorios criptográficos, pedidos en lotes de 32 bits. */
  class SecureBatchRNG {
    constructor(cryptoImpl) {
      this.crypto = cryptoImpl || global.crypto;
      // getRandomValues admite como mucho 65 536 bytes por llamada.
      this.words = new Uint32Array(16384);
      this.index = this.words.length;
    }

    refill() {
      this.crypto.getRandomValues(this.words);
      this.index = 0;
    }

    nextWord() {
      if (this.index >= this.words.length) this.refill();
      return this.words[this.index++];
    }
  }

  class Simulation {
    constructor(options, rng) {
      this.options = Object.assign({}, DEFAULTS, options);
      this.rng = rng || new SecureBatchRNG();
      this.reset();
    }

    reset() {
      const { playerCount, initialBank, trackedIds, historyPoints } =
        this.options;
      this.banks = new Int32Array(playerCount).fill(initialBank);
      this.ruinedAts = new Int32Array(playerCount);
      // Jugadores todavía en juego; los arruinados salen de la lista.
      this.active = new Int32Array(playerCount);
      for (let i = 0; i < playerCount; i++) this.active[i] = i;
      this.activeCount = playerCount;
      this.matchCount = 0;
      this.word = 0;
      this.bitsLeft = 0;

      // Historial muestreado: cuando se llena, se queda con uno de cada dos
      // puntos y dobla el intervalo, así siempre cubre la partida entera.
      this.historyStride = 1;
      this.historyLength = 0;
      this.historyRounds = new Int32Array(historyPoints);
      this.history = trackedIds.map(() => new Int32Array(historyPoints));
      this.recordHistory();
    }

    step(rounds) {
      const banks = this.banks;
      const active = this.active;
      let activeCount = this.activeCount;
      let word = this.word;
      let bitsLeft = this.bitsLeft;

      for (let r = 0; r < rounds && activeCount > 0; r++) {
        const round = ++this.matchCount;
        let j = 0;
        while (j < activeCount) {
          if (bitsLeft === 0) {
            word = this.rng.nextWord();
            bitsLeft = 32;
          }
          const id = active[j];
          // +1 o -1 sin "if": ganar o perder es un 50/50 que la CPU no puede
          // predecir, y un salto mal predicho por apuesta triplica el coste.
          banks[id] += ((word & 1) << 1) - 1;
          if (banks[id] === 0) {
            this.ruinedAts[id] = round;
            // El último activo ocupa este hueco y juega en esta misma ronda.
            active[j] = active[--activeCount];
          } else {
            j++;
          }
          word >>>= 1;
          bitsLeft--;
        }
        if (round % this.historyStride === 0) this.recordHistory();
      }

      this.activeCount = activeCount;
      this.word = word;
      this.bitsLeft = bitsLeft;
    }

    recordHistory() {
      if (this.historyLength === this.historyRounds.length) this.compactHistory();
      const at = this.historyLength++;
      this.historyRounds[at] = this.matchCount;
      const ids = this.options.trackedIds;
      for (let k = 0; k < ids.length; k++) {
        this.history[k][at] = this.banks[ids[k]];
      }
    }

    compactHistory() {
      const half = this.historyLength >> 1;
      for (let i = 0; i < half; i++) {
        this.historyRounds[i] = this.historyRounds[i * 2];
        for (const track of this.history) track[i] = track[i * 2];
      }
      this.historyLength = half;
      this.historyStride *= 2;
    }

    getHistory() {
      const ids = this.options.trackedIds;
      const rounds = Array.from(this.historyRounds.subarray(0, this.historyLength));
      const history = {};
      ids.forEach((id, k) => {
        history[id] = Array.from(this.history[k].subarray(0, this.historyLength));
      });
      // Añade la ronda actual si no coincide con el último punto muestreado.
      if (rounds[rounds.length - 1] !== this.matchCount) {
        rounds.push(this.matchCount);
        ids.forEach((id) => history[id].push(this.banks[id]));
      }
      return { ids: ids.slice(), points: rounds, history, rounds: this.matchCount };
    }
  }

  /**
   * Responde a los mensajes de la interfaz (INIT, START, STOP, RESET, SPEED,
   * GET_HISTORY). `post(msg, transfer)` envía la respuesta.
   */
  function createController(post, options) {
    const sim = new Simulation(options);
    let roundsPerTick = 1000;
    let timer = null;

    function sendUpdate() {
      const banks = sim.banks.slice();
      const ruinedAts = sim.ruinedAts.slice();
      post(
        {
          type: "UPDATE",
          banks,
          ruinedAts,
          matchCount: sim.matchCount,
          activeCount: sim.activeCount,
        },
        [banks.buffer, ruinedAts.buffer],
      );
    }

    // Cada tick espera solo lo que le falta hasta TICK_MS: si el cálculo tarda
    // más, no se acumulan ticks y STOP/SPEED se atienden enseguida.
    function tick() {
      const started = Date.now();
      sim.step(roundsPerTick);
      sendUpdate();
      if (sim.activeCount === 0) {
        timer = null;
        post({ type: "FINISHED" });
        return;
      }
      const elapsed = Date.now() - started;
      timer = setTimeout(tick, Math.max(0, TICK_MS - elapsed));
    }

    function stop() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    }

    return {
      sim,
      isRunning: () => timer !== null,
      handle(data) {
        switch (data.type) {
          case "INIT":
            sendUpdate();
            break;
          case "START":
            if (timer === null && sim.activeCount > 0) timer = setTimeout(tick, 0);
            break;
          case "STOP":
            stop();
            break;
          case "RESET":
            stop();
            sim.reset();
            sendUpdate();
            break;
          case "SPEED": {
            const value = parseInt(data.value, 10);
            if (!isNaN(value)) {
              roundsPerTick = Math.max(1, Math.min(value, MAX_ROUNDS_PER_TICK));
            }
            break;
          }
          case "GET_HISTORY":
            post(Object.assign({ type: "HISTORY" }, sim.getHistory()));
            break;
        }
      },
    };
  }

  const MonosSim = {
    DEFAULTS,
    COLOR,
    MAX_ROUNDS_PER_TICK,
    colorIndex,
    calculateStats,
    SecureBatchRNG,
    Simulation,
    createController,
  };

  global.MonosSim = MonosSim;
  if (typeof module !== "undefined" && module.exports) module.exports = MonosSim;
})(typeof self !== "undefined" ? self : globalThis);
