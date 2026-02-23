const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

// Read worker.js
const workerPath = path.join(__dirname, '..', 'worker.js');
const workerContent = fs.readFileSync(workerPath, 'utf8');

// Extract SecureBatchRNG class
const rngClassMatch = workerContent.match(/class SecureBatchRNG \{[\s\S]*?\n\}/);
if (!rngClassMatch) {
    throw new Error('Could not find SecureBatchRNG class in worker.js');
}
const rngClassSource = rngClassMatch[0];

// Helper to create the class with a mocked crypto
function getSecureBatchRNGClass(mockCrypto) {
    const factory = new Function('self', `
        ${rngClassSource}
        return SecureBatchRNG;
    `);
    return factory({ crypto: mockCrypto });
}

test('SecureBatchRNG Boilerplate and Initialization', async (t) => {
    await t.test('should initialize with correct buffer size and index', () => {
        const SecureBatchRNG = getSecureBatchRNGClass({ getRandomValues: () => {} });
        const rng = new SecureBatchRNG();
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
        const SecureBatchRNG = getSecureBatchRNGClass(mockCrypto);
        const rng = new SecureBatchRNG();

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
                // Fill first byte with 0b10101001 (0xA9)
                // bit 0 (value 1) -> 1
                // bit 1 (value 2) -> 0
                // bit 2 (value 4) -> 0
                // bit 3 (value 8) -> 1
                // bit 4 (value 16) -> 0
                // bit 5 (value 32) -> 1
                // bit 6 (value 64) -> 0
                // bit 7 (value 128) -> 1
                view[0] = 0xA9;
                return view;
            }
        };
        const SecureBatchRNG = getSecureBatchRNGClass(mockCrypto);
        const rng = new SecureBatchRNG();
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
        const SecureBatchRNG = getSecureBatchRNGClass(mockCrypto);
        const rng = new SecureBatchRNG();
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
        const SecureBatchRNG = getSecureBatchRNGClass(mockCrypto);
        const rng = new SecureBatchRNG();

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
