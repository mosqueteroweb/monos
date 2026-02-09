const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

// Read index.html
const indexPath = path.join(__dirname, '..', 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// Extract getColor function using regex
// This regex looks for the function getColor(bank) { ... }
const getColorMatch = indexContent.match(/function getColor\(bank\) \{[\s\S]*?\n\s*?\}/);

if (!getColorMatch) {
    throw new Error('Could not find getColor function in index.html');
}

// Extract BANK_COLORS
const bankColorsMatch = indexContent.match(/const BANK_COLORS = \{[\s\S]*?\};/);
if (!bankColorsMatch) {
    throw new Error('Could not find BANK_COLORS constant in index.html');
}

const getColorSource = getColorMatch[0];
const bankColorsSource = bankColorsMatch[0];

// Use new Function to create a callable version of getColor
const getColor = new Function('bank', `
    ${bankColorsSource}
    ${getColorSource}
    return getColor(bank);
`);

test('getColor Unit Tests (Updated Palette)', async (t) => {
    // 1. Arruinados (<= 0): Negro (#000000)
    await t.test('should return Black (#000000) for <= 0', () => {
        assert.strictEqual(getColor(0), '#000000');
        assert.strictEqual(getColor(-50), '#000000');
    });

    // 2. Perdiendo (< 900): Naranja (#ff9800)
    await t.test('should return Orange (#ff9800) for <= 900', () => {
        assert.strictEqual(getColor(1), '#ff9800');
        assert.strictEqual(getColor(500), '#ff9800');
        assert.strictEqual(getColor(900), '#ff9800');
    });

    // 3. Neutro (901 - 1099): Amarillo (#ffeb3b)
    await t.test('should return Yellow (#ffeb3b) for 901-1099', () => {
        assert.strictEqual(getColor(901), '#ffeb3b');
        assert.strictEqual(getColor(1000), '#ffeb3b');
        assert.strictEqual(getColor(1099), '#ffeb3b');
    });

    // 4. Ganando (1100 - 1999): Verde Normal (#4caf50)
    await t.test('should return Normal Green (#4caf50) for 1100-1999', () => {
        assert.strictEqual(getColor(1100), '#4caf50');
        assert.strictEqual(getColor(1500), '#4caf50');
        assert.strictEqual(getColor(1999), '#4caf50');
    });

    // 5. x2 (2000 - 2999): Verde Resaltado (#00e676)
    await t.test('should return Highlight Green (#00e676) for 2000-2999', () => {
        assert.strictEqual(getColor(2000), '#00e676');
        assert.strictEqual(getColor(2500), '#00e676');
        assert.strictEqual(getColor(2999), '#00e676');
    });

    // 6. x3 (3000 - 4999): Azul (#2196f3)
    await t.test('should return Blue (#2196f3) for 3000-4999', () => {
        assert.strictEqual(getColor(3000), '#2196f3');
        assert.strictEqual(getColor(4000), '#2196f3');
        assert.strictEqual(getColor(4999), '#2196f3');
    });

    // 7. x5 (5000 - 9999): Rojo (#f44336)
    await t.test('should return Red (#f44336) for 5000-9999', () => {
        assert.strictEqual(getColor(5000), '#f44336');
        assert.strictEqual(getColor(7500), '#f44336');
        assert.strictEqual(getColor(9999), '#f44336');
    });

    // 8. x10 (>= 10000): Fucsia (#e91e63)
    await t.test('should return Fuchsia (#e91e63) for >= 10000', () => {
        assert.strictEqual(getColor(10000), '#e91e63');
        assert.strictEqual(getColor(50000), '#e91e63');
    });
});
