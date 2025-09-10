const assert = require('node:assert');
const { it, describe } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Fuel emissions config', () => {
  it('handles loading, edits, new fuels and deletion', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fuel-'));
    const versionDir = path.join(tmp, '0');
    fs.mkdirSync(versionDir);
    const prevDir = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = tmp;

    global.angular = { module: () => ({ directive: () => ({}) }) };
    const app = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    app.loadFuelEmissionsConfig();
    const userFile = app.loadFuelEmissionsConfig.userFile;

    let data = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    assert.strictEqual(data.CO2.Gasoline, 2392);
    assert.strictEqual(data.NOx.Gasoline, 10);

    data.CO2.Gasoline = 1234;
    fs.writeFileSync(userFile, JSON.stringify(data));
    assert.strictEqual(app.calculateCO2Factor('Gasoline', 90, false, false), 1234);

    app.calculateCO2Factor('NewFuel', 90, false, false);
    data = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    assert.strictEqual(data.CO2.NewFuel, 0);
    assert.strictEqual(data.NOx.NewFuel, 0);

    fs.unlinkSync(userFile);
    assert.strictEqual(app.calculateCO2Factor('Gasoline', 90, false, false), 2392);
    const recreated = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    assert.strictEqual(recreated.CO2.Gasoline, 2392);

    if (prevDir === undefined) delete process.env.KRTEKTM_BNG_USER_DIR;
    else process.env.KRTEKTM_BNG_USER_DIR = prevDir;
  });
});
