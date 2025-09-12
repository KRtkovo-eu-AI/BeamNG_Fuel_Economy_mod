const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

global.angular = { module: () => ({ directive: () => ({}) }) };
const {
  loadAvgConsumptionAlgorithm,
  saveAvgConsumptionAlgorithm,
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('average consumption algorithm config', () => {
  it('defaults to optimized and persists setting', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alg-'));
    const verDir = path.join(tmp, '1.0');
    fs.mkdirSync(verDir, { recursive: true });
    const prev = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = tmp;

    const algo = loadAvgConsumptionAlgorithm();
    assert.strictEqual(algo, 'optimized');
    const file = path.join(verDir, 'settings', 'krtektm_fuelEconomy', 'settings.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(data.AvgConsumptionAlgorithm, 'optimized');

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

  it('saves selected algorithm to settings.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alg-'));
    const verDir = path.join(tmp, '1.0');
    fs.mkdirSync(verDir, { recursive: true });
    const prev = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = tmp;

    saveAvgConsumptionAlgorithm('direct');
    const file = path.join(verDir, 'settings', 'krtektm_fuelEconomy', 'settings.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(data.AvgConsumptionAlgorithm, 'direct');

    if (prev === undefined) delete process.env.KRTEKTM_BNG_USER_DIR; else process.env.KRTEKTM_BNG_USER_DIR = prev;
  });

  it('computes average consumption directly', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => cb(JSON.stringify({ t: 'Gasoline' }))
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const handlers = {};
    const $scope = { $on: (name, fn) => { handlers[name] = fn; }, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 0));

    $scope.setAvgConsumptionAlgorithm('direct');

    const streams1 = {
      engineInfo: Array(14).fill(0),
      electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0.5, rpmTacho: 2000 }
    };
    streams1.engineInfo[11] = 50;
    streams1.engineInfo[12] = 60;
    streams1.engineInfo[13] = 90;

    handlers['streamsUpdate'](null, streams1);
    await new Promise(r => setTimeout(r, 0));

    const streams2 = {
      engineInfo: Array(14).fill(0),
      electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 2000 }
    };
    streams2.engineInfo[11] = 49;
    streams2.engineInfo[12] = 60;
    streams2.engineInfo[13] = 90;
    now = 100000;
    handlers['streamsUpdate'](null, streams2);
    await new Promise(r => setTimeout(r, 0));

    assert.strictEqual($scope.avgL100km, '100.0 L/100km');
  });

  it('auto resets cumulative totals for direct algorithm', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => cb(JSON.stringify({ t: 'Gasoline' }))
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const handlers = {};
    const $scope = { $on: (name, fn) => { handlers[name] = fn; }, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 0));

    $scope.setAvgConsumptionAlgorithm('direct');

    const base = { engineInfo: Array(14).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0.5, rpmTacho: 2000, trip: 0 } };
    base.engineInfo[11] = 50;
    base.engineInfo[12] = 60;
    base.engineInfo[13] = 90;
    handlers['streamsUpdate'](null, base);
    await new Promise(r => setTimeout(r, 0));

    const run1 = { engineInfo: Array(14).fill(0), electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 2000, trip: 1000 } };
    run1.engineInfo[11] = 49;
    run1.engineInfo[12] = 60;
    run1.engineInfo[13] = 90;
    now = 100000;
    handlers['streamsUpdate'](null, run1);
    await new Promise(r => setTimeout(r, 0));

    assert.strictEqual($scope.avgL100km, '100.0 L/100km');
    assert.strictEqual($scope.tripFuelUsedLiquid, '1.00 L');

    const reset = { engineInfo: Array(14).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0, trip: 0 } };
    reset.engineInfo[11] = 50;
    reset.engineInfo[12] = 60;
    reset.engineInfo[13] = 90;
    now = 100100;
    handlers['streamsUpdate'](null, reset);
    await new Promise(r => setTimeout(r, 0));

    assert.strictEqual($scope.avgL100km, '0.0 L/100km');
    assert.strictEqual($scope.tripFuelUsedLiquid, '1.00 L');

    const run2 = { engineInfo: Array(14).fill(0), electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 2000, trip: 115.3 } };
    run2.engineInfo[11] = 49.91;
    run2.engineInfo[12] = 60;
    run2.engineInfo[13] = 90;
    now = 111630;
    handlers['streamsUpdate'](null, run2);
    await new Promise(r => setTimeout(r, 0));

    assert.strictEqual($scope.avgL100km, '78.1 L/100km');
    assert.strictEqual($scope.tripFuelUsedLiquid, '1.09 L');
  });

  it('clears per-run stats when engine stops without resetting trip', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => cb(JSON.stringify({ t: 'Gasoline' }))
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const handlers = {};
    const $scope = { $on: (name, fn) => { handlers[name] = fn; }, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 0));

    $scope.setAvgConsumptionAlgorithm('direct');

    const base = { engineInfo: Array(14).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0.5, rpmTacho: 2000, trip: 0 } };
    base.engineInfo[11] = 50;
    base.engineInfo[12] = 60;
    base.engineInfo[13] = 90;
    handlers['streamsUpdate'](null, base);
    await new Promise(r => setTimeout(r, 0));

    const run = { engineInfo: Array(14).fill(0), electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 2000, trip: 1000 } };
    run.engineInfo[11] = 49;
    run.engineInfo[12] = 60;
    run.engineInfo[13] = 90;
    now = 100000;
    handlers['streamsUpdate'](null, run);
    await new Promise(r => setTimeout(r, 0));

    assert.strictEqual($scope.avgL100km, '100.0 L/100km');
    assert.strictEqual($scope.tripFuelUsedLiquid, '1.00 L');

    const engineOff = { engineInfo: Array(14).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0, trip: 1000 } };
    engineOff.engineInfo[11] = 49;
    engineOff.engineInfo[12] = 60;
    engineOff.engineInfo[13] = 90;
    now = 100100;
    handlers['streamsUpdate'](null, engineOff);
    await new Promise(r => setTimeout(r, 0));

    assert.strictEqual($scope.avgL100km, '0.0 L/100km');
    assert.strictEqual($scope.fuelUsed, '0.00 L');
    assert.strictEqual($scope.tripFuelUsedLiquid, '1.00 L');
  });
});
