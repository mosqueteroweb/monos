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
// We wrap it to ensure it returns the result of the internal getColor
const getColor = new Function('bank', `
    ${bankColorsSource}
    ${getColorSource}
    return getColor(bank);
`);

test('getColor Unit Tests', async (t) => {
    await t.test('should return black (#000000) when bank is <= 0', () => {
        assert.strictEqual(getColor(0), '#000000');
        assert.strictEqual(getColor(-10), '#000000');
    });

    await t.test('should return red (#f44336) when bank is between 1 and 100', () => {
        assert.strictEqual(getColor(1), '#f44336');
        assert.strictEqual(getColor(50), '#f44336');
        assert.strictEqual(getColor(100), '#f44336');
    });

    await t.test('should return orange (#ff9800) when bank is between 101 and 500', () => {
        assert.strictEqual(getColor(101), '#ff9800');
        assert.strictEqual(getColor(300), '#ff9800');
        assert.strictEqual(getColor(500), '#ff9800');
    });

    await t.test('should return yellow (#ffeb3b) when bank is between 501 and 999', () => {
        assert.strictEqual(getColor(501), '#ffeb3b');
        assert.strictEqual(getColor(999), '#ffeb3b');
    });

    await t.test('should return blue (#2196f3) when bank is between 1000 and 1999', () => {
        assert.strictEqual(getColor(1000), '#2196f3');
        assert.strictEqual(getColor(1500), '#2196f3');
        assert.strictEqual(getColor(1999), '#2196f3');
    });

    await t.test('should return green (#4caf50) when bank is between 2000 and 2999', () => {
        assert.strictEqual(getColor(2000), '#4caf50');
        assert.strictEqual(getColor(2500), '#4caf50');
        assert.strictEqual(getColor(2999), '#4caf50');
    });

    await t.test('should return neon green (#00ff00) when bank is >= 3000', () => {
        assert.strictEqual(getColor(3000), '#00ff00');
        assert.strictEqual(getColor(5000), '#00ff00');
    });
});
