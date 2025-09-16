const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

global.angular = { module: () => ({ directive: () => ({}) }) };
const { loadFuelEmissionsConfig, ensureFuelEmissionType } = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('fuel emissions config', () => {
  it('creates, reloads and extends fuelEmissions.json without redundant writes', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'em-'));
    const verDir = path.join(tmp, '1.0');
    fs.mkdirSync(verDir, { recursive: true });
    process.env.KRTEKTM_BNG_USER_DIR = tmp;

    const cfg1 = loadFuelEmissionsConfig();
    const file = loadFuelEmissionsConfig.userFile;
    assert.ok(fs.existsSync(file));
    const saved1 = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepStrictEqual(saved1, cfg1);
    assert.strictEqual(cfg1.Diesel.CO2, 2640);
    assert.strictEqual(cfg1.Diesel.NOx, 20);
    const m1 = fs.statSync(file).mtimeMs;
    await new Promise(r => setTimeout(r, 20));
    loadFuelEmissionsConfig();
    const m2 = fs.statSync(file).mtimeMs;
    assert.strictEqual(m2, m1);

    fs.unlinkSync(file);
    const cfg2 = loadFuelEmissionsConfig();
    const saved2 = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepStrictEqual(saved2, cfg2);

    const m3 = fs.statSync(file).mtimeMs;
    await new Promise(r => setTimeout(r, 20));
    ensureFuelEmissionType('Unobtanium');
    const m4 = fs.statSync(file).mtimeMs;
    assert.ok(m4 > m3);
    await new Promise(r => setTimeout(r, 20));
    ensureFuelEmissionType('Unobtanium');
    const m5 = fs.statSync(file).mtimeMs;
    assert.strictEqual(m5, m4);

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('handles the BeamNG current user folder layout', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emcur-'));
    const base = path.join(tmp, 'BeamNG', 'BeamNG.drive');
    const current = path.join(base, 'current');
    fs.mkdirSync(current, { recursive: true });
    const prev = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = base;

    const cfg = loadFuelEmissionsConfig();
    const expected = path.join(
      current,
      'settings',
      'krtektm_fuelEconomy',
      'fuelEmissions.json'
    );
    assert.strictEqual(loadFuelEmissionsConfig.userFile, expected);
    assert.ok(fs.existsSync(expected));
    const saved = JSON.parse(fs.readFileSync(expected, 'utf8'));
    assert.deepStrictEqual(saved, cfg);

    await new Promise(r => setTimeout(r, 20));
    ensureFuelEmissionType('BeamFuel');
    const updated = JSON.parse(fs.readFileSync(expected, 'utf8'));
    assert.ok(updated.BeamFuel);

    if (prev === undefined) delete process.env.KRTEKTM_BNG_USER_DIR;
    else process.env.KRTEKTM_BNG_USER_DIR = prev;
  });
});
