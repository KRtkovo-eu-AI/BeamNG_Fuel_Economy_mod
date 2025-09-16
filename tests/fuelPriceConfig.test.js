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

  it('loads config from the BeamNG current directory layout', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fpcur-'));
    const base = path.join(tmp, 'BeamNG', 'BeamNG.drive');
    const current = path.join(base, 'current');
    fs.mkdirSync(current, { recursive: true });
    const prev = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = base;

    const cfg1 = loadFuelPriceConfig();
    const expected = path.join(
      current,
      'settings',
      'krtektm_fuelEconomy',
      'fuelPrice.json'
    );
    assert.strictEqual(loadFuelPriceConfig.userFile, expected);
    assert.ok(fs.existsSync(expected));
    assert.strictEqual(cfg1.currency, 'money');
    assert.strictEqual(cfg1.prices.Gasoline, 0);
    assert.strictEqual(cfg1.prices.Electricity, 0);

    fs.writeFileSync(
      expected,
      JSON.stringify({ prices: { Gasoline: 3.5, Electricity: 1.2 }, currency: 'Kč' })
    );
    const cfg2 = loadFuelPriceConfig();
    assert.strictEqual(cfg2.currency, 'Kč');
    assert.strictEqual(cfg2.prices.Gasoline, 3.5);
    assert.strictEqual(cfg2.prices.Electricity, 1.2);

    if (prev === undefined) delete process.env.KRTEKTM_BNG_USER_DIR;
    else process.env.KRTEKTM_BNG_USER_DIR = prev;
  });
});
