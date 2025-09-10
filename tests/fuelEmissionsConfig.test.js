const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

global.angular = { module: () => ({ directive: () => ({}) }) };
const { loadFuelEmissionsConfig, ensureFuelEmissionType } = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('fuel emissions config', () => {
  it('creates, reloads and extends fuelEmissions.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'em-'));
    const verDir = path.join(tmp, '1.0');
    fs.mkdirSync(verDir, { recursive: true });
    process.env.KRTEKTM_BNG_USER_DIR = tmp;

    const cfg1 = loadFuelEmissionsConfig();
    const file = loadFuelEmissionsConfig.userFile;
    assert.ok(fs.existsSync(file));
    const saved1 = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepStrictEqual(saved1, cfg1);
    assert.strictEqual(cfg1.CO2.Diesel, 2640);
    assert.strictEqual(cfg1.NOx.Diesel, 20);

    fs.unlinkSync(file);
    const cfg2 = loadFuelEmissionsConfig();
    const saved2 = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepStrictEqual(saved2, cfg2);

    ensureFuelEmissionType('Unobtanium');
    const saved3 = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(saved3.CO2.Unobtanium, 0);
    assert.strictEqual(saved3.NOx.Unobtanium, 0);
  });
});
