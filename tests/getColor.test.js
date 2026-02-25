const test = require('node:test');
const assert = require('node:assert');
const { getColor, BANK_COLORS } = require('../logic.js');

test('getColor Unit Tests (Updated Palette)', async (t) => {
    // 1. Arruinados (<= 0): Negro (#000000)
    await t.test('should return Black (#000000) for <= 0', () => {
        assert.strictEqual(getColor(0), BANK_COLORS.BLACK);
        assert.strictEqual(getColor(-50), BANK_COLORS.BLACK);
    });

    // 2. Perdiendo (< 900): Naranja (#ff9800)
    await t.test('should return Orange (#ff9800) for <= 900', () => {
        assert.strictEqual(getColor(1), BANK_COLORS.ORANGE);
        assert.strictEqual(getColor(500), BANK_COLORS.ORANGE);
        assert.strictEqual(getColor(900), BANK_COLORS.ORANGE);
    });

    // 3. Neutro (901 - 1099): Amarillo (#ffeb3b)
    await t.test('should return Yellow (#ffeb3b) for 901-1099', () => {
        assert.strictEqual(getColor(901), BANK_COLORS.YELLOW);
        assert.strictEqual(getColor(1000), BANK_COLORS.YELLOW);
        assert.strictEqual(getColor(1099), BANK_COLORS.YELLOW);
    });

    // 4. Ganando (1100 - 1999): Verde Normal (#4caf50)
    await t.test('should return Normal Green (#4caf50) for 1100-1999', () => {
        assert.strictEqual(getColor(1100), BANK_COLORS.GREEN_NORMAL);
        assert.strictEqual(getColor(1500), BANK_COLORS.GREEN_NORMAL);
        assert.strictEqual(getColor(1999), BANK_COLORS.GREEN_NORMAL);
    });

    // 5. x2 (2000 - 2999): Verde Resaltado (#00e676)
    await t.test('should return Highlight Green (#00e676) for 2000-2999', () => {
        assert.strictEqual(getColor(2000), BANK_COLORS.GREEN_HIGHLIGHT);
        assert.strictEqual(getColor(2500), BANK_COLORS.GREEN_HIGHLIGHT);
        assert.strictEqual(getColor(2999), BANK_COLORS.GREEN_HIGHLIGHT);
    });

    // 6. x3 (3000 - 4999): Azul (#2196f3)
    await t.test('should return Blue (#2196f3) for 3000-4999', () => {
        assert.strictEqual(getColor(3000), BANK_COLORS.BLUE);
        assert.strictEqual(getColor(4000), BANK_COLORS.BLUE);
        assert.strictEqual(getColor(4999), BANK_COLORS.BLUE);
    });

    // 7. x5 (5000 - 9999): Rojo (#f44336)
    await t.test('should return Red (#f44336) for 5000-9999', () => {
        assert.strictEqual(getColor(5000), BANK_COLORS.RED);
        assert.strictEqual(getColor(7500), BANK_COLORS.RED);
        assert.strictEqual(getColor(9999), BANK_COLORS.RED);
    });

    // 8. x10 (>= 10000): Fucsia (#ff00ff)
    await t.test('should return Fuchsia (#ff00ff) for >= 10000', () => {
        assert.strictEqual(getColor(10000), BANK_COLORS.FUCHSIA);
        assert.strictEqual(getColor(50000), BANK_COLORS.FUCHSIA);
    });
});
