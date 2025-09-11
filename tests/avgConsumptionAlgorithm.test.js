const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

global.angular = { module: () => ({ directive: () => ({}) }) };
const { loadAvgConsumptionAlgorithm } = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('average consumption algorithm config', () => {
  it('defaults to queue and persists setting', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alg-'));
    const verDir = path.join(tmp, '1.0');
    fs.mkdirSync(verDir, { recursive: true });
    const prev = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = tmp;

    const algo = loadAvgConsumptionAlgorithm();
    assert.strictEqual(algo, 'queue');
    const file = path.join(verDir, 'settings', 'krtektm_fuelEconomy', 'settings.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(data.AvgConsumptionAlgorithm, 'queue');

    if (prev === undefined) delete process.env.KRTEKTM_BNG_USER_DIR; else process.env.KRTEKTM_BNG_USER_DIR = prev;
  });

  it('reads direct algorithm from settings.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alg-'));
    const settingsDir = path.join(tmp, '1.0', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(settingsDir, { recursive: true });
    const file = path.join(settingsDir, 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ AvgConsumptionAlgorithm: 'direct' }));
    const prev = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = tmp;

    const algo = loadAvgConsumptionAlgorithm();
    assert.strictEqual(algo, 'direct');

    if (prev === undefined) delete process.env.KRTEKTM_BNG_USER_DIR; else process.env.KRTEKTM_BNG_USER_DIR = prev;
  });
});
