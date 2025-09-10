const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

global.angular = { module: () => ({ directive: () => ({}) }) };
const { loadFuelPriceConfig } = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('fuel price config', () => {
  it('does not rewrite fuelPrice.json when unchanged', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'));
    const verDir = path.join(tmp, '1.0');
    fs.mkdirSync(verDir, { recursive: true });
    const prev = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = tmp;

    loadFuelPriceConfig();
    const file = loadFuelPriceConfig.userFile;
    const m1 = fs.statSync(file).mtimeMs;
    await new Promise(r => setTimeout(r, 20));
    loadFuelPriceConfig();
    const m2 = fs.statSync(file).mtimeMs;
    assert.strictEqual(m2, m1);

    if (prev === undefined) delete process.env.KRTEKTM_BNG_USER_DIR;
    else process.env.KRTEKTM_BNG_USER_DIR = prev;
  });
});
