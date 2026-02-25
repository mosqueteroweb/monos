const test = require('node:test');
const assert = require('node:assert');
const { SecureBatchRNG } = require('../logic.js');

test('SecureBatchRNG Boilerplate and Initialization', async (t) => {
    await t.test('should initialize with correct buffer size and index', () => {
        const mockCrypto = { getRandomValues: () => {} };
        const rng = new SecureBatchRNG(mockCrypto);
        assert.strictEqual(rng.BUFFER_SIZE, 128 * 1024);
        assert.strictEqual(rng.bitIndex, 0);
        assert.ok(rng.buffer instanceof Uint8Array);
        assert.strictEqual(rng.buffer.length, 128 * 1024);
    });
});

test('SecureBatchRNG Refill Mechanism', async (t) => {
    await t.test('should refill buffer using chunks of 65536', () => {
        const calls = [];
        const mockCrypto = {
            getRandomValues: (view) => {
                calls.push(view.length);
                return view;
            }
        };
        const rng = new SecureBatchRNG(mockCrypto);

        rng.refill();

        // BUFFER_SIZE is 131072, CHUNK_SIZE is 65536
        // 131072 / 65536 = 2 calls
        assert.strictEqual(calls.length, 2);
        assert.strictEqual(calls[0], 65536);
        assert.strictEqual(calls[1], 65536);
        assert.strictEqual(rng.bitIndex, 0);
    });
});

test('SecureBatchRNG Bit Extraction', async (t) => {
    await t.test('should extract bits in Little Endian order from bytes', () => {
        const mockCrypto = {
            getRandomValues: (view) => {
                view[0] = 0xA9;
                return view;
            }
        };
        const rng = new SecureBatchRNG(mockCrypto);
        rng.refill();

        const expectedBits = [1, 0, 0, 1, 0, 1, 0, 1];
        for (let i = 0; i < 8; i++) {
            assert.strictEqual(rng.getBit(), expectedBits[i], `Bit at index ${i} is incorrect`);
        }
    });

    await t.test('should extract bits across multiple bytes', () => {
        const mockCrypto = {
            getRandomValues: (view) => {
                view[0] = 0x01; // 00000001
                view[1] = 0x80; // 10000000
                return view;
            }
        };
        const rng = new SecureBatchRNG(mockCrypto);
        rng.refill();

        assert.strictEqual(rng.getBit(), 1); // bit 0 of byte 0
        for(let i=0; i<7; i++) rng.getBit(); // consume rest of byte 0

        for(let i=0; i<7; i++) assert.strictEqual(rng.getBit(), 0); // first 7 bits of byte 1
        assert.strictEqual(rng.getBit(), 1); // last bit of byte 1
    });
});

test('SecureBatchRNG Edge Cases', async (t) => {
    await t.test('should trigger refill when buffer is exhausted', () => {
        let refillCount = 0;
        const mockCrypto = {
            getRandomValues: (view) => {
                refillCount++;
                return view;
            }
        };
        const rng = new SecureBatchRNG(mockCrypto);

        const totalBits = rng.BUFFER_SIZE * 8;

        // Exhaust the buffer minus 1 bit
        rng.bitIndex = totalBits - 1;
        assert.strictEqual(refillCount, 0);

        rng.getBit(); // Consumes the last bit
        assert.strictEqual(refillCount, 0);
        assert.strictEqual(rng.bitIndex, totalBits);

        rng.getBit(); // Should trigger refill
        assert.strictEqual(refillCount, 2); // refill() calls getRandomValues twice
        assert.strictEqual(rng.bitIndex, 1);
    });
});
