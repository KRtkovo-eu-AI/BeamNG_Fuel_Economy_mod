const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'okFuelEconomy', 'ui', 'modules', 'apps', 'okFuelEconomy', 'app.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractAttr(source, startMarker) {
  const start = source.indexOf(startMarker);
  let i = start + startMarker.length;
  let value = '';
  let inSingle = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      value += ch;
      i++;
      if (i < source.length) value += source[i];
    } else if (ch === "'") {
      inSingle = !inSingle;
      value += ch;
    } else if (ch === '"' && !inSingle) {
      break;
    } else {
      value += ch;
    }
    i++;
  }
  return value;
}

function getNgAttrStyle(elementMarker) {
  const elemIdx = html.indexOf(elementMarker);
  const slice = html.slice(elemIdx);
  return extractAttr(slice, 'ng-attr-style="');
}

function parseStyle(expr) {
  const prefix = "{{ '";
  const delim = "' + (useCustomStyles ? '";
  const suffix = "' : '') }}";
  const base = expr.slice(prefix.length, expr.indexOf(delim));
  const custom = expr.slice(expr.indexOf(delim) + delim.length, expr.lastIndexOf(suffix));
  return { base, custom };
}

describe('UI template styling', () => {
  it('toggles custom styling correctly', () => {
    const attr = getNgAttrStyle('<div class="bngApp"');
    const { base, custom } = parseStyle(attr);
    const styleTrue = base + custom;

    assert.ok(base.includes('position:relative;'));
    assert.ok(!base.includes('background-color'));
    assert.ok(styleTrue.includes('background-color:rgba(10,15,20,0.75);'));
    assert.ok(styleTrue.includes('background-image:linear-gradient'));
    assert.ok(!styleTrue.includes("url('app.png')"));
  });

  it('renders fuel cost bindings without inline script', () => {
    assert.ok(!html.includes('fetch('));
    assert.ok(html.includes('fuelPriceNotice'));
    assert.ok(html.includes('Open Fuel Price Editor'));
    assert.ok(html.includes('Open Fuel Emissions Editor'));
    assert.ok(!html.includes('<script type="text/javascript">'));
    assert.ok(html.includes('{{ costPrice }}'));
    assert.ok(html.includes('{{ avgCost }}'));
    assert.ok(html.includes('{{ totalCost }}'));
    assert.ok(html.includes('Liquid: {{ tripAvgCostLiquid }}'));
    assert.ok(html.includes('Electricity: {{ tripAvgCostElectric }}'));
    assert.ok(html.includes('Liquid: {{ tripTotalCostLiquid }}'));
    assert.ok(html.includes('Electricity: {{ tripTotalCostElectric }}'));
    assert.ok(html.includes('Liquid: {{ tripFuelUsedLiquid }}'));
    assert.ok(html.includes('Electricity: {{ tripFuelUsedElectric }}'));
  });

  it('includes a unit selector in settings', () => {
    assert.ok(html.includes('Units:'));
    assert.ok(html.includes('{{ unitModeLabels[unitMode] }}'));
    assert.ok(html.includes('ng-repeat="(value,label) in unitModeOptions"'));
  });

  it('shows web endpoint port when running', () => {
    assert.ok(html.includes('{{ webEndpointPort }}'));
  });

  it('hides food unit mode from selection options', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.window = {};
    global.bngApi = { engineLua: () => {} };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);
    assert.ok($scope.unitModeLabels.food);
    assert.ok(!$scope.unitModeOptions.food);
  });

  it('loads fuel price editor via controller function', async () => {
    let directiveDef;
    let luaCmd;
      global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
      global.StreamsManager = { add: () => {}, remove: () => {} };
      global.UiUnits = { buildString: () => '' };
      global.window = {};
    global.bngApi = { engineLua: cmd => { luaCmd = cmd; } };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);

    $scope.openFuelPriceEditor({ preventDefault() {} });
    assert.equal(
      luaCmd,
      'extensions.load("fuelPriceEditor") extensions.fuelPriceEditor.setLiquidUnit("L") extensions.fuelPriceEditor.open()'
    );
  });

  it('loads fuel emissions editor via controller function', async () => {
    let directiveDef;
    let luaCmd;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.window = {};
    global.bngApi = { engineLua: cmd => { luaCmd = cmd; } };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);

    $scope.openFuelEmissionsEditor({ preventDefault() {} });
    assert.equal(
      luaCmd,
      'extensions.load("fuelEmissionsEditor") extensions.fuelEmissionsEditor.setLiquidUnit("L") extensions.fuelEmissionsEditor.open()'
    );
  });

  it('does not open fuel price editor when changing unit preference', () => {
    let directiveDef;
    const cmds = [];
      global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
      global.StreamsManager = { add: () => {}, remove: () => {} };
      global.UiUnits = { buildString: () => '' };
      global.window = {};
    global.bngApi = { engineLua: cmd => { cmds.push(cmd); } };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);
    cmds.length = 0;
    $scope.setUnit('imperial');
    assert.deepStrictEqual(cmds, []);
  });

  it('updates editor liquid units when preference changes', () => {
    let directiveDef;
    const cmds = [];
      global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
      global.StreamsManager = { add: () => {}, remove: () => {} };
      global.UiUnits = { buildString: () => '' };
      global.window = {};
    global.bngApi = { engineLua: cmd => { cmds.push(cmd); } };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);

    $scope.openFuelPriceEditor({ preventDefault() {} });
    $scope.openFuelEmissionsEditor({ preventDefault() {} });
    cmds.length = 0;
    $scope.setUnit('imperial');
    $scope.setUnit('metric');

    assert.deepStrictEqual(cmds, [
      'extensions.fuelPriceEditor.setLiquidUnit("gal")',
      'extensions.fuelEmissionsEditor.setLiquidUnit("gal")',
      'extensions.fuelPriceEditor.setLiquidUnit("L")',
      'extensions.fuelEmissionsEditor.setLiquidUnit("L")'
    ]);
  });

  it('shows CO2 in g/mi when imperial units selected', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => cb(JSON.stringify({ t: 'Gasoline' }))
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let t = 0;
    global.performance = { now: () => { t += 1000; return t; } };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const handlers = {};
    const $scope = { $on: (name, fn) => { handlers[name] = fn; }, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 50));

    $scope.setUnit('imperial');
    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0 } };
    handlers['streamsUpdate'](null, streams);
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual($scope.instantCO2, '0 g/mi');
    assert.strictEqual($scope.avgCO2, '0 g/mi');
  });

  it('persists style preference to localStorage', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {};
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    global.performance = { now: () => 0 };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);
    assert.strictEqual($scope.useCustomStyles, true);
    $scope.toggleCustomStyles();
    assert.strictEqual($scope.useCustomStyles, false);
    assert.strictEqual(store.okFuelEconomyUseCustomStyles, 'false');
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    directiveDef = undefined;
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn2 = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope2 = { $on: () => {} };
    controllerFn2({ debug: () => {} }, $scope2);
    assert.strictEqual($scope2.useCustomStyles, false);
  });

  it('exposes fuel prices and currency in fuelPrice.json', () => {
    const priceConfigPath = path.join(__dirname, '..', 'okFuelEconomy', 'ui', 'modules', 'apps', 'okFuelEconomy', 'fuelPrice.json');
    const cfg = JSON.parse(fs.readFileSync(priceConfigPath, 'utf8'));
    assert.ok(Object.prototype.hasOwnProperty.call(cfg, 'prices'));
    assert.ok(Object.prototype.hasOwnProperty.call(cfg.prices, 'Gasoline'));
    assert.ok(Object.prototype.hasOwnProperty.call(cfg.prices, 'Electricity'));
    assert.ok(Object.prototype.hasOwnProperty.call(cfg, 'currency'));
  });


  it('loads fuel prices from fuelPrice.json via app.js', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '0.99', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 2.25, Electricity: 0.5 }, currency: 'CZK' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    assert.strictEqual($scope.liquidFuelPriceValue, 2.25);
    assert.strictEqual($scope.electricityPriceValue, 0.5);
    assert.strictEqual($scope.currency, 'CZK');

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('resets total cost when switching vehicles', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.00', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 1.5, Electricity: 0.5 }, currency: 'USD' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80; streams.engineInfo[13] = 90;
    now = 0; $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58; now = 100000; $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.totalCost, '3.00 USD');
    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');

    $scope.on_VehicleFocusChanged();
    streams.engineInfo[11] = 70; streams.engineInfo[12] = 90;
    now = 200000; $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.totalCost, '0.00 USD');
    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('preserves trip averages on vehicle change', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    $scope.tripAvgHistory = 'persist';
    $scope.tripAvgKmLHistory = 'persist';

    $scope.on_VehicleFocusChanged();

    assert.strictEqual($scope.tripAvgHistory, 'persist');
    assert.strictEqual($scope.tripAvgKmLHistory, 'persist');
  });

  it('migrates legacy fuelPrice.json via app.js', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '0.97', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    const cfgPath = path.join(verDir, 'fuelPrice.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ liquidFuelPrice: 5, electricityPrice: 2, currency: 'CAD' }));

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    assert.strictEqual($scope.liquidFuelPriceValue, 5);
    assert.strictEqual($scope.electricityPriceValue, 2);
    assert.strictEqual($scope.currency, 'CAD');
    const saved = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.deepStrictEqual(saved, { prices: { Gasoline: 5, Electricity: 2 }, currency: 'CAD' });

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('updates fuel prices when fuelPrice.json changes', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    process.env.KRTEKTM_FUEL_POLL_MS = '20';
    const verDir = path.join(tmp, '0.98', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    const cfgPath = path.join(verDir, 'fuelPrice.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ prices: { Gasoline: 1, Electricity: 0.2 }, currency: 'USD' }));

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setImmediate(r));

    assert.strictEqual($scope.liquidFuelPriceValue, 1);
    assert.strictEqual($scope.electricityPriceValue, 0.2);
    assert.strictEqual($scope.currency, 'USD');

    fs.writeFileSync(cfgPath, JSON.stringify({ prices: { Gasoline: 3, Electricity: 0.8 }, currency: 'EUR' }));
    await new Promise(r => setTimeout(r, 60));
    assert.strictEqual($scope.liquidFuelPriceValue, 3);
    assert.strictEqual($scope.electricityPriceValue, 0.8);
    assert.strictEqual($scope.currency, 'EUR');

    fs.writeFileSync(cfgPath, '{broken');
    await new Promise(r => setTimeout(r, 60));
    assert.strictEqual($scope.liquidFuelPriceValue, 0);
    assert.strictEqual($scope.electricityPriceValue, 0);
    assert.strictEqual($scope.currency, 'money');

    delete process.env.KRTEKTM_BNG_USER_DIR;
    delete process.env.KRTEKTM_FUEL_POLL_MS;
  });

  it('defaults new fuel types to zero cost', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    process.env.KRTEKTM_FUEL_POLL_MS = '20';
    const verDir = path.join(tmp, '0.99', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    const cfgPath = path.join(verDir, 'fuelPrice.json');
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ prices: { Gasoline: 5, Electricity: 1 }, currency: 'USD' })
    );

    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => cb(JSON.stringify({ t: 'Diesel' }))
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 80));

    assert.strictEqual($scope.fuelPrices.Diesel, 0);
    assert.strictEqual($scope.liquidFuelPriceValue, 0);
    delete process.env.KRTEKTM_BNG_USER_DIR;
    delete process.env.KRTEKTM_FUEL_POLL_MS;
  });

  it('ignores Air storage when other fuel types exist', async () => {
    let directiveDef, luaCode;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    process.env.KRTEKTM_FUEL_POLL_MS = '20';
    const verDir = path.join(tmp, '1.00', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    const cfgPath = path.join(verDir, 'fuelPrice.json');
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ prices: { Gasoline: 5, Electricity: 1 }, currency: 'USD' })
    );

    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => {
        luaCode = code;
        cb(JSON.stringify({ t: 'Diesel' }));
      }
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 80));

    assert.ok(luaCode.includes('s.energyType and s.energyType:lower()~="air"'));
    assert.strictEqual($scope.fuelType, 'Diesel');

    delete process.env.KRTEKTM_BNG_USER_DIR;
    delete process.env.KRTEKTM_FUEL_POLL_MS;
  });

  it('adds Air fuel type when it is the only energy source', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    process.env.KRTEKTM_FUEL_POLL_MS = '20';
    const verDir = path.join(tmp, '1.01', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    const cfgPath = path.join(verDir, 'fuelPrice.json');
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ prices: { Gasoline: 5, Electricity: 1 }, currency: 'USD' })
    );

    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => cb(JSON.stringify({ t: 'Air' }))
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 80));

    assert.strictEqual($scope.fuelType, 'Air');
    assert.strictEqual($scope.fuelPrices.Air, 0);

    delete process.env.KRTEKTM_BNG_USER_DIR;
    delete process.env.KRTEKTM_FUEL_POLL_MS;
  });

  it('displays None for empty fuel type and does not add price entry', async () => {
    let directiveDef;
    const engineCalls = [];
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    process.env.KRTEKTM_FUEL_POLL_MS = '20';
    const verDir = path.join(tmp, '1.02', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    const cfgPath = path.join(verDir, 'fuelPrice.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ prices: { Gasoline: 5 }, currency: 'USD' }));

    global.bngApi = {
      engineLua: cmd => engineCalls.push(cmd),
      activeObjectLua: (code, cb) => cb(JSON.stringify({ t: '' }))
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 80));

    assert.strictEqual($scope.fuelType, 'None');
    assert.ok(!('None' in $scope.fuelPrices));
    assert.ok(!('' in $scope.fuelPrices));
    assert.ok(engineCalls.every(c => !c.includes('ensureFuelType')));

    delete process.env.KRTEKTM_BNG_USER_DIR;
    delete process.env.KRTEKTM_FUEL_POLL_MS;
  });

  it('detects player on foot and switches to Food fuel type and kcal units', async () => {
    let directiveDef, luaCode;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => { luaCode = code; cb(JSON.stringify({ t: 'Food' })); }
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const handlers = {};
    const $scope = { $on: (name, cb) => { handlers[name] = cb; }, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 80));

    assert.ok(luaCode.includes('hasTire'));
    assert.strictEqual($scope.fuelType, 'Food');
    assert.strictEqual($scope.unitFlowUnit, 'kcal/h');
    assert.strictEqual($scope.instantLph, '0.0 kcal/h');
    assert.strictEqual($scope.instantL100km, '0.0 kcal/100km');
    assert.strictEqual($scope.instantKmL, '0.00 km/kcal');
    assert.strictEqual($scope.instantCO2, '0 g/km');
    assert.strictEqual($scope.co2Class, 'A');
    assert.strictEqual($scope.avgCO2, '0 g/km');
    assert.strictEqual($scope.avgCo2Class, 'A');
    assert.strictEqual($scope.avgCo2Compliant, false);

    handlers['streamsUpdate'](null, { electrics: { wheelspeed: 0, airspeed: 0, trip: 0 }, engineInfo: Array(15).fill(0) });
    assert.strictEqual($scope.avgCo2Compliant, false);
  });

  it('computes traveled distance when on foot', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => cb(JSON.stringify({ t: 'Food' }))
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let t = 0;
    global.performance = { now: () => { t += 1000; return t; } };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const handlers = {};
    const $scope = { $on: (name, fn) => { handlers[name] = fn; }, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 50));
    const streams = { electrics: { wheelspeed: 1000 } };
    handlers['streamsUpdate'](null, streams);
    await new Promise(r => setTimeout(r, 0));
    handlers['streamsUpdate'](null, streams);
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual($scope.data6, '0.0 km');
    assert.strictEqual($scope.data1, '2.0 km');
  });

  it('restores vehicle units when re-entering a car before engine start', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    let call = 0;
    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => {
        call++;
        if (call === 1 || call === 2) cb(JSON.stringify({ t: 'Food' }));
        else cb(JSON.stringify({ t: 'Gasoline' }));
      }
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const handlers = {};
    const $scope = {
      $on: (name, fn) => { handlers[name] = fn; },
      $evalAsync: fn => setImmediate(fn)
    };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 50));

    // initial on-foot state
    assert.strictEqual($scope.unitFlowUnit, 'kcal/h');
    assert.strictEqual($scope.instantLph, '0.0 kcal/h');
    assert.strictEqual($scope.instantL100km, '0.0 kcal/100km');
    assert.strictEqual($scope.instantKmL, '0.00 km/kcal');
    assert.strictEqual($scope.instantCO2, '0 g/km');
    assert.strictEqual($scope.co2Class, 'A');
    assert.strictEqual($scope.avgCO2, '0 g/km');
    assert.strictEqual($scope.avgCo2Class, 'A');

    // simulate entering a vehicle where fuel type is not yet known
    handlers['VehicleFocusChanged']();
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual($scope.unitFlowUnit, 'kcal/h');

    // streams update should trigger another fetch that resolves to Gasoline
    handlers['streamsUpdate'](null, { engineInfo: {}, electrics: {} });
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual($scope.fuelType, 'Gasoline');
    assert.strictEqual($scope.unitFlowUnit, 'L/h');
    assert.strictEqual($scope.instantLph, '0.0 L/h');
    assert.strictEqual($scope.instantL100km, '0.0 L/100km');
    assert.strictEqual($scope.instantKmL, '0.00 km/L');
    assert.strictEqual($scope.instantCO2, '0 g/km');
    assert.strictEqual($scope.co2Class, 'A');
    assert.strictEqual($scope.avgCO2, '0 g/km');
    assert.strictEqual($scope.avgCo2Class, 'A');
    assert.strictEqual($scope.fuelUsed, '0.00 L');
    assert.strictEqual($scope.fuelLeft, '0.00 L');
    assert.strictEqual($scope.fuelCap, '0.0 L');
    assert.strictEqual($scope.avgL100km, '0.0 L/100km');
    assert.strictEqual($scope.avgKmL, '0.00 km/L');
    assert.strictEqual($scope.avgCO2, '0 g/km');
    assert.strictEqual($scope.avgCo2Class, 'A');
  });

  it('preserves trip values when switching to Food fuel type', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    let call = 0;
    global.bngApi = {
      engineLua: () => {},
      activeObjectLua: (code, cb) => {
        call++;
        if (call === 1) cb(JSON.stringify({ t: 'Gasoline' }));
        else cb(JSON.stringify({ t: 'Food' }));
      }
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
    await new Promise(r => setTimeout(r, 50));

    // configure prices and simulate driving to accumulate trip values
    $scope.liquidFuelPriceValue = 1.5;
    $scope.currency = 'USD';
    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80; streams.engineInfo[13] = 90;
    now = 0; handlers['streamsUpdate'](null, streams);
    await new Promise(r => setTimeout(r, 0));
    streams.engineInfo[11] = 58; now = 100000; handlers['streamsUpdate'](null, streams);
    await new Promise(r => setTimeout(r, 0));
    const tripCostBefore = $scope.tripTotalCostLiquid;
    const tripFuelBefore = $scope.tripFuelUsedLiquid;
    const tripAvgCo2Before = $scope.tripAvgCO2;
    const tripClassBefore = $scope.tripCo2Class;
    const tripTotalCo2Before = $scope.tripTotalCO2;
    const tripTotalNoxBefore = $scope.tripTotalNOx;

    // leaving the vehicle triggers a fuel type fetch that returns Food
    handlers['VehicleFocusChanged']();
    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual($scope.tripTotalCostLiquid, tripCostBefore);
    assert.strictEqual($scope.tripFuelUsedLiquid, tripFuelBefore);
    assert.strictEqual($scope.tripAvgCO2, tripAvgCo2Before);
    assert.strictEqual($scope.tripCo2Class, tripClassBefore);
    assert.strictEqual($scope.tripTotalCO2, tripTotalCo2Before);
    assert.strictEqual($scope.tripTotalNOx, tripTotalNoxBefore);

    // subsequent stream updates while on foot must not alter trip values
    const streamsFoot = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, trip: 0, throttle_input: 0, rpmTacho: 0 } };
    handlers['streamsUpdate'](null, streamsFoot);
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual($scope.tripTotalCostLiquid, tripCostBefore);
    assert.strictEqual($scope.tripFuelUsedLiquid, tripFuelBefore);
    assert.strictEqual($scope.tripAvgCO2, tripAvgCo2Before);
    assert.strictEqual($scope.tripCo2Class, tripClassBefore);
    assert.strictEqual($scope.tripTotalCO2, tripTotalCo2Before);
    assert.strictEqual($scope.tripTotalNOx, tripTotalNoxBefore);

    $scope.resetOverall();
    assert.strictEqual($scope.tripTotalCostLiquid, '');
    assert.strictEqual($scope.tripFuelUsedLiquid, '');
    assert.strictEqual($scope.tripAvgCO2, '0 g/km');
    assert.strictEqual($scope.tripCo2Class, 'A');
    assert.strictEqual($scope.tripTotalCO2, '');
    assert.strictEqual($scope.tripTotalNOx, '');
  });

  it('keeps avg and trip CO₂ classes separate', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => {}, activeObjectLua: () => {} };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const handlers = {};
    const $scope = { $on: (n, fn) => { handlers[n] = fn; }, $evalAsync: fn => setImmediate(fn) };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setTimeout(r, 50));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 27.78, trip: 0, throttle_input: 0.5, rpmTacho: 2000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;
    handlers['streamsUpdate'](null, streams);
    await new Promise(r => setImmediate(r));

    assert.strictEqual($scope.avgCo2Class, 'A');
    assert.strictEqual($scope.tripCo2Class, 'A');

    $scope.tripCo2Class = 'G';
    assert.strictEqual($scope.avgCo2Class, 'A');

    $scope.avgCo2Class = 'B';
    assert.strictEqual($scope.tripCo2Class, 'G');
  });

  it('loads fuel prices via bngApi.engineLua when require is unavailable', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    const cfgPath = path.join(tmp, 'settings', 'krtektm_fuelEconomy', 'fuelPrice.json');
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify({ prices: { Gasoline: 4, Electricity: 1.2 }, currency: 'Kč' }));

    global.bngApi = {
      engineLua: (code, cb) => {
        if (!code.includes('core_paths.getUserPath')) return;
        assert.ok(code.startsWith('(function()'), 'Lua chunk should be wrapped in a function');
        assert.ok(code.includes('core_paths.getUserPath'));
        try {
          cb(fs.readFileSync(cfgPath, 'utf8'));
        } catch (e) {
          cb(JSON.stringify({ prices: { Gasoline: 0, Electricity: 0 }, currency: 'money' }));
        }
      }
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    const realProcess = global.process;
    const realSetInterval = global.setInterval;
    global.process = undefined;
    global.setInterval = (fn, ms) => realSetInterval(fn, 20);

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(r => setImmediate(r));

    assert.strictEqual($scope.liquidFuelPriceValue, 4);
    assert.strictEqual($scope.electricityPriceValue, 1.2);
    assert.strictEqual($scope.currency, 'Kč');

    fs.writeFileSync(cfgPath, JSON.stringify({ prices: { Gasoline: 5, Electricity: 1.5 }, currency: '€' }));
    await new Promise(r => setTimeout(r, 60));
    assert.strictEqual($scope.liquidFuelPriceValue, 5);
    assert.strictEqual($scope.electricityPriceValue, 1.5);
    assert.strictEqual($scope.currency, '€');

    fs.writeFileSync(cfgPath, '{bad');
    await new Promise(r => setTimeout(r, 60));
    assert.strictEqual($scope.liquidFuelPriceValue, 0);
    assert.strictEqual($scope.electricityPriceValue, 0);
    assert.strictEqual($scope.currency, 'money');

    global.process = realProcess;
    global.setInterval = realSetInterval;
  });

  it('defaults fuel price when fuelPrice.json is missing', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    fs.mkdirSync(path.join(tmp, '0.50'), { recursive: true });

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80; streams.engineInfo[13] = 90;
    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58; streams.engineInfo[13] = 90;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.liquidFuelPriceValue, 0);
    assert.strictEqual($scope.electricityPriceValue, 0);
    assert.strictEqual($scope.currency, 'money');
    assert.strictEqual($scope.costPrice, '0.00 money/L');
    assert.strictEqual($scope.avgCost, '0.00 money/km');
    assert.strictEqual($scope.totalCost, '0.00 money');
    assert.strictEqual($scope.tripAvgCostLiquid, '0.00 money/km');
    assert.strictEqual($scope.tripAvgCostElectric, '0.00 money/km');
    assert.strictEqual($scope.tripTotalCostLiquid, '0.00 money');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 money');

    const cfgPath = path.join(tmp, '0.50', 'settings', 'krtektm_fuelEconomy', 'fuelPrice.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.strictEqual(cfg.prices.Gasoline, 0);

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('positions reset, style toggle and settings icons consistently', () => {
    const resetAttr = getNgAttrStyle('ng-click="reset($event)"');
    const toggleAttr = getNgAttrStyle('ng-click="toggleCustomStyles()"');
    const settingsAttr = getNgAttrStyle('ng-click="settingsOpen=!settingsOpen"');
    const r = parseStyle(resetAttr);
    const t = parseStyle(toggleAttr);
    const s = parseStyle(settingsAttr);

    assert.ok(r.base.includes('position:absolute; top:2px; right:4px;'));
    assert.ok(t.base.includes('position:absolute; top:24px; right:4px;'));
    assert.ok(s.base.includes('position:absolute; top:46px; right:4px;'));
    [r, t, s].forEach(obj => {
      assert.ok(obj.base.includes('cursor:pointer;'));
      assert.ok(obj.base.includes('font-size:18px;'));
      assert.ok(obj.custom.includes('color:#5fdcff;'));
    });
  });

  it('preserves neon background and typography when custom styles are enabled', () => {
    assert.ok(html.includes('background-image:linear-gradient'));
    assert.ok(html.includes('border-radius:10px;'));
    assert.ok(html.includes('color:#aeeaff;'));
    assert.ok(html.includes('font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif;'));
    assert.ok(!html.includes('font-family:"'));
    assert.ok(html.includes('box-shadow: inset 0 0 10px rgba(0,200,255,0.25);'));
  });

  it('provides all data placeholders and icons', () => {
    const placeholders = ['data1','fuelUsed','fuelLeft','fuelCap','avgL100km','avgKmL','avgCO2','avgCo2Class','data4','instantLph','instantL100km','instantKmL','instantCO2','instantHistory','instantKmLHistory','data6','tripAvgL100km','tripAvgKmL','tripAvgCO2','tripTotalCO2','tripTotalNOx','tripAvgHistory','tripAvgKmLHistory','avgHistory','avgKmLHistory','data8','data9','unitDistanceUnit','tripFuelUsedLiquid','tripFuelUsedElectric','tripCo2Class'];
    placeholders.forEach(p => {
      if (p === 'instantHistory') {
        assert.ok(html.includes('instantHistory'), 'missing instantHistory');
      } else if (p === 'avgHistory') {
        assert.ok(html.includes('avgHistory'), 'missing avgHistory');
      } else if (p === 'avgCo2Class') {
        assert.ok(html.includes('avgCo2Class'), 'missing avgCo2Class');
      } else if (p === 'tripCo2Class') {
        assert.ok(html.includes('tripCo2Class'), 'missing tripCo2Class');
      } else {
        assert.ok(html.includes(`{{ ${p} }}`), `missing ${p}`);
      }
    });
    assert.ok(html.includes('{{ vehicleNameStr }}'));
    assert.ok(html.includes('strong ng-if="visible.heading"'));
    assert.ok(html.includes('ng-click="reset($event)"'));
    assert.ok(html.includes('ng-click="toggleCustomStyles()"'));
    assert.ok(html.includes('ng-click="settingsOpen=!settingsOpen"'));
    assert.ok(html.includes('autorenew'));
    assert.ok(html.includes('palette'));
    assert.ok(html.includes('settings'));
    assert.ok(html.includes('<span class="material-icons"')); 
    assert.ok(html.includes('save</span>'));

    assert.ok(html.includes('{{ avgCO2 }} |'));
    ['A','B','C','D','E','F','G'].forEach(cls => {
      assert.ok(html.includes(`<svg ng-if="avgCo2Class === '${cls}'"`), `missing avg svg ${cls}`);
      assert.ok(html.includes(`<svg ng-if="tripCo2Class === '${cls}'"`), `missing trip svg ${cls}`);
    });
    assert.ok(!html.includes('<use'));
    assert.ok(!html.includes('ng-if="tripCo2Class"'));
    assert.ok(html.includes('{{ tripAvgCO2 }} |'));
    assert.ok(html.includes('{{ instantCO2 }}'));
    assert.ok(!html.includes('modules/apps/okFuelEconomy/eu_co2_classes/'));
    assert.ok(!html.includes('{{ co2Class }}'));
  });

  it('allows toggling visibility of heading and subfields', () => {
    assert.ok(html.includes('ng-if="visible.distanceMeasured || visible.distanceEcu"'));
    assert.ok(html.includes('ng-if="visible.fuelUsed || visible.fuelLeft || visible.fuelCap"'));
    assert.ok(html.includes('ng-if="visible.avgL100km || visible.avgKmL"'));
    assert.ok(html.includes('ng-if="visible.avgCO2"'));
    assert.ok(html.includes('ng-if="visible.instantLph || visible.instantL100km || visible.instantKmL"'));
    assert.ok(html.includes('ng-if="visible.instantCO2"'));
    assert.ok(html.includes('ng-if="visible.tripAvgL100km || visible.tripAvgKmL"'));
    assert.ok(html.includes('ng-if="visible.tripAvgCO2"'));
    assert.ok(html.includes('ng-if="visible.tripTotalCO2"'));
    assert.ok(html.includes('ng-if="visible.tripTotalNOx"'));
    assert.ok(html.includes('ng-if="visible.instantGraph"'));
    assert.ok(html.includes('ng-if="visible.avgCost"'));
    assert.ok(html.includes('ng-if="visible.tripFuelUsed"'));
    assert.ok(html.includes('ng-if="visible.tripAvgCost"'));
    assert.ok(html.includes('ng-if="visible.tripTotalCost"'));
    const toggles = ['visible.heading','visible.distanceMeasured','visible.distanceEcu','visible.fuelUsed','visible.fuelLeft','visible.fuelCap','visible.avgL100km','visible.avgKmL','visible.avgCO2','visible.avgGraph','visible.avgKmLGraph','visible.instantLph','visible.instantL100km','visible.instantKmL','visible.instantCO2','visible.instantGraph','visible.instantKmLGraph','visible.tripAvgL100km','visible.tripAvgKmL','visible.tripAvgCO2','visible.tripTotalCO2','visible.tripTotalNOx','visible.tripGraph','visible.tripKmLGraph','visible.costPrice','visible.avgCost','visible.totalCost','visible.tripFuelUsed','visible.tripAvgCost','visible.tripTotalCost'];
    toggles.forEach(t => {
      assert.ok(html.includes(`ng-model="${t}"`), `missing toggle ${t}`);
    });
  });
});

describe('controller integration', () => {
  it('updates heading pause flag from stream', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: (cmd, cb) => { if (typeof cb === 'function') cb(false); } };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn(), vehicleNameStr: 'Car' };
    controllerFn({ debug: () => {} }, $scope);

    assert.strictEqual($scope.gamePaused, false);
    $scope.on_streamsUpdate(null, { okGameState: { paused: true } });
    assert.strictEqual($scope.gamePaused, true);
  });

  it('polls pause state without return prefix', () => {
    let directiveDef;
    const cmds = [];
    let pollFn;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = {
      engineLua: (cmd, cb) => {
        cmds.push(cmd);
        if (typeof cb === 'function') cb(false);
      },
    };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    const realSetInterval = global.setInterval;
    global.setInterval = (fn, ms) => {
      if (!pollFn) pollFn = fn;
      return { unref() {} };
    };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    cmds.length = 0; // ignore extension load
    pollFn();
    assert.deepStrictEqual(cmds, [
      'extensions.okGameState and extensions.okGameState.getState and extensions.okGameState.getState().paused',
    ]);

    global.setInterval = realSetInterval;
  });
  it('hides cost fields by default', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    assert.strictEqual($scope.visible.costPrice, false);
    assert.strictEqual($scope.visible.avgCost, false);
    assert.strictEqual($scope.visible.totalCost, false);
    assert.strictEqual($scope.visible.tripFuelUsed, false);
    assert.strictEqual($scope.visible.tripAvgCost, false);
    assert.strictEqual($scope.visible.tripTotalCost, false);
    assert.strictEqual($scope.visible.tripTotalCO2, false);
    assert.strictEqual($scope.visible.tripTotalNOx, false);
  });
  it('applies currency before engine starts', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], co2Queue: [], distance: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.10', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 1.5, Electricity: 0.5 }, currency: 'USD' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {}, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    assert.strictEqual($scope.totalCost, '0.00 USD');
    assert.strictEqual($scope.avgCost, '0.00 USD/km');
    assert.strictEqual($scope.tripAvgCostLiquid, '0.00 USD/km');
    assert.strictEqual($scope.tripTotalCostLiquid, '0.00 USD');

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });
  it('computes fuel costs via controller', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.00', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 1.5, Electricity: 0.5 }, currency: 'USD' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80; streams.engineInfo[13] = 90;
    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58; streams.engineInfo[13] = 90;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.costPrice, '0.00 USD/L');
    assert.strictEqual($scope.avgCost, '0.08 USD/km');
    assert.strictEqual($scope.totalCost, '3.00 USD');
    assert.strictEqual($scope.tripAvgCostLiquid, '0.04 USD/km');
    assert.strictEqual($scope.tripAvgCostElectric, '0.01 USD/km');
    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '2.00 L');
    assert.strictEqual($scope.tripFuelUsedElectric, '0.00 kWh');
    assert.strictEqual($scope.tripTotalCO2, '4.78 kg');
    assert.strictEqual($scope.tripTotalNOx, '20 g');
    assert.ok(Math.abs(parseFloat($scope.totalCost) - parseFloat($scope.fuelUsed) * 1.5) < 1e-6);
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostElectric) - parseFloat($scope.tripFuelUsedElectric) * 0.5) < 1e-6);

    $scope.setUnit('electric');
    streams.engineInfo[11] = 56;
    now = 200000;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.costPrice, '0.00 USD/kWh');
    assert.strictEqual($scope.avgCost, '0.03 USD/km');
    assert.strictEqual($scope.totalCost, '2.00 USD');
    assert.ok(parseFloat($scope.tripAvgCostLiquid) > 0);
    assert.strictEqual($scope.tripAvgCostElectric, '0.03 USD/km');
    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');
    assert.strictEqual($scope.tripTotalCostElectric, '1.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '2.00 L');
    assert.strictEqual($scope.tripFuelUsedElectric, '2.00 kWh');
    assert.strictEqual($scope.tripTotalCO2, '4.78 kg');
    assert.strictEqual($scope.tripTotalNOx, '20 g');
    assert.ok(Math.abs(parseFloat($scope.totalCost) - parseFloat($scope.fuelUsed) * 0.5) < 1e-6);
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostElectric) - parseFloat($scope.tripFuelUsedElectric) * 0.5) < 1e-6);

    $scope.setUnit('metric');
    streams.engineInfo[11] = 54;
    now = 300000;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.costPrice, '0.00 USD/L');
    assert.strictEqual($scope.avgCost, '0.11 USD/km');
    assert.strictEqual($scope.totalCost, '9.00 USD');
    assert.ok(parseFloat($scope.tripAvgCostLiquid) > 0);
    assert.strictEqual($scope.tripAvgCostElectric, '0.03 USD/km');
    assert.strictEqual($scope.tripTotalCostLiquid, '6.00 USD');
    assert.strictEqual($scope.tripTotalCostElectric, '1.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '4.00 L');
    assert.strictEqual($scope.tripFuelUsedElectric, '2.00 kWh');
    assert.ok(Math.abs(parseFloat($scope.totalCost) - parseFloat($scope.fuelUsed) * 1.5) < 1e-6);
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostElectric) - parseFloat($scope.tripFuelUsedElectric) * 0.5) < 1e-6);
    assert.strictEqual($scope.tripTotalCO2, '9.57 kg');
    assert.strictEqual($scope.tripTotalNOx, '40 g');

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('updates trip average cost while stationary', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.01', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 1.5, Electricity: 0.5 }, currency: 'USD' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80; streams.engineInfo[13] = 90;
    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58; streams.engineInfo[13] = 90;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    streams.electrics.wheelspeed = 0;
    streams.electrics.throttle_input = 0;
    streams.engineInfo[11] = 57;
    now = 200000;
    $scope.on_streamsUpdate(null, streams);

    const liquid = parseFloat($scope.tripAvgCostLiquid);
    const electric = parseFloat($scope.tripAvgCostElectric);
    assert.ok(liquid < 0.15);
    assert.ok(electric < 0.05);

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('subtracts electric trip cost when regenerating', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.02', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 1.5, Electricity: 0.5 }, currency: 'USD' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    $scope.setUnit('electric');
    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58; streams.engineInfo[13] = 90;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCostElectric, '1.00 USD');
    assert.strictEqual($scope.tripTotalCostLiquid, '0.00 USD');
    assert.strictEqual($scope.tripFuelUsedElectric, '2.00 kWh');
    assert.strictEqual($scope.tripFuelUsedLiquid, '0.00 L');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostElectric) - parseFloat($scope.tripFuelUsedElectric) * 0.5) < 1e-6);

    streams.engineInfo[11] = 59; streams.engineInfo[13] = 90;
    now = 200000;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCostElectric, '0.50 USD');
    assert.strictEqual($scope.tripTotalCostLiquid, '0.00 USD');
    assert.strictEqual($scope.tripFuelUsedElectric, '1.00 kWh');
    assert.strictEqual($scope.tripFuelUsedLiquid, '0.00 L');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostElectric) - parseFloat($scope.tripFuelUsedElectric) * 0.5) < 1e-6);

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('tracks trip fuel usage for total cost', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.03', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 1.5, Electricity: 0 }, currency: 'USD' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58; streams.engineInfo[13] = 90;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    const stored = JSON.parse(store.okFuelEconomyOverall);
    assert.ok(Math.abs(stored.fuelUsedLiquid - 2) < 1e-6);
    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '2.00 L');
    assert.strictEqual($scope.tripFuelUsedElectric, '0.00 kWh');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);
    assert.strictEqual($scope.tripAvgCO2, '60 g/km');
    assert.strictEqual($scope.tripCo2Class, 'A');
    assert.strictEqual($scope.tripTotalCO2, '4.78 kg');
    assert.strictEqual($scope.tripTotalNOx, '20 g');

    $scope.resetOverall();
    const storedAfter = JSON.parse(store.okFuelEconomyOverall);
    assert.strictEqual(storedAfter.fuelUsedLiquid, 0);
    assert.strictEqual(storedAfter.fuelUsedElectric, 0);
    assert.strictEqual($scope.tripTotalCostLiquid, '');
    assert.strictEqual($scope.tripTotalCostElectric, '');
    assert.strictEqual($scope.tripFuelUsedLiquid, '');
    assert.strictEqual($scope.tripFuelUsedElectric, '');
    assert.strictEqual($scope.tripAvgCO2, '0 g/km');
    assert.strictEqual($scope.tripCo2Class, 'A');
    assert.strictEqual($scope.tripTotalCO2, '');
    assert.strictEqual($scope.tripTotalNOx, '');

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('retains trip total cost across vehicle changes', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (t, v, p) => (v.toFixed ? v.toFixed(p) : String(v)) };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.04', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 1.5, Electricity: 0 }, currency: 'USD' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '2.00 L');
    assert.strictEqual($scope.tripFuelUsedElectric, '0.00 kWh');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);

    streams.engineInfo[11] = 70; streams.engineInfo[12] = 90;
    now = 200000;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '2.00 L');
    assert.strictEqual($scope.tripFuelUsedElectric, '0.00 kWh');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);

    $scope.on_VehicleFocusChanged();

    streams.engineInfo[11] = 70;
    now = 250000;
    $scope.on_streamsUpdate(null, streams);

    streams.engineInfo[11] = 69;
    now = 300000;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCostLiquid, '4.50 USD');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '3.00 L');
    assert.strictEqual($scope.tripFuelUsedElectric, '0.00 kWh');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);

    const stored = JSON.parse(store.okFuelEconomyOverall);
    assert.ok(Math.abs(stored.fuelUsedLiquid - 3) < 1e-6);

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('restores trip totals after controller reload', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (t, v, p) => (v.toFixed ? v.toFixed(p) : String(v)) };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.05', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 1.5, Electricity: 0 }, currency: 'USD' })
    );

    function loadController() {
      let def;
      global.angular = { module: () => ({ directive: (name, arr) => { def = arr[0](); } }) };
      global.StreamsManager = { add: () => {}, remove: () => {} };
      global.UiUnits = { buildString: (t, v, p) => (v.toFixed ? v.toFixed(p) : String(v)) };
      global.bngApi = { engineLua: () => '' };
      delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
      require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
      const ctrl = def.controller[def.controller.length - 1];
      const scope = { $on: (name, cb) => { scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
      ctrl({ debug: () => {} }, scope);
      return scope;
    }

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;

    let $scope = loadController();
    await new Promise(resolve => setImmediate(resolve));
    now = 0; $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58; now = 100000; $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '2.00 L');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);

    let stored = JSON.parse(store.okFuelEconomyOverall);
    assert.strictEqual(stored.tripCostLiquid, 3);
    assert.ok(stored.tripDistanceLiquid > 0);

    streams.engineInfo[11] = 58; now = 0; // reset time for reload
    $scope = loadController();
    await new Promise(resolve => setImmediate(resolve));
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCostLiquid, '3.00 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '2.00 L');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);

    streams.engineInfo[11] = 57; now = 100000; $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCostLiquid, '4.50 USD');
    assert.strictEqual($scope.tripFuelUsedLiquid, '3.00 L');
    assert.ok(Math.abs(parseFloat($scope.tripTotalCostLiquid) - parseFloat($scope.tripFuelUsedLiquid) * 1.5) < 1e-6);

    stored = JSON.parse(store.okFuelEconomyOverall);
    assert.strictEqual(stored.tripCostLiquid, 4.5);
    assert.ok(Math.abs(stored.fuelUsedLiquid - 3) < 1e-6);

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('avoids spurious tank drop when engine shuts off', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fuel-'));
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    const verDir = path.join(tmp, '1.06', 'settings', 'krtektm_fuelEconomy');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(
      path.join(verDir, 'fuelPrice.json'),
      JSON.stringify({ prices: { Gasoline: 32.5, Electricity: 0 }, currency: 'money' })
    );

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 70; streams.engineInfo[12] = 80;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 69;
    now = 1000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripTotalCostLiquid, '32.50 money');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 money');

    streams.electrics.rpmTacho = 500;
    streams.electrics.throttle_input = 0;
    streams.engineInfo[11] = 0;
    now = 2000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripTotalCostLiquid, '32.50 money');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 money');

    streams.electrics.rpmTacho = 0;
    streams.engineInfo[11] = 0;
    now = 3000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripTotalCostLiquid, '32.50 money');
    assert.strictEqual($scope.tripTotalCostElectric, '0.00 money');

    delete process.env.KRTEKTM_BNG_USER_DIR;
  });

  it('retains instant consumption when fuel flow reading stalls', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 49.9;
    now = 1000;
    $scope.on_streamsUpdate(null, streams);

    streams.electrics.throttle_input = 0;
    streams.engineInfo[11] = 49.9;
    now = 2000;
    $scope.on_streamsUpdate(null, streams);

    assert.notStrictEqual($scope.instantLph, '0.0 L/h');
    assert.notStrictEqual($scope.instantL100km, '0.0 L/100km');
    assert.notStrictEqual($scope.instantCO2, '0 g/km');
  });
  it('populates data fields from stream updates', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: (() => { let t = 0; return () => { t += 1000; return t; }; })() };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = {
      $on: (name, cb) => { $scope['on_' + name] = cb; },
      $evalAsync: fn => fn()
    };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 10, trip: 5, throttle_input: 0.5, rpmTacho: 1000 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 49.9;
    $scope.on_streamsUpdate(null, streams);

    const fields = ['data1','fuelUsed','fuelLeft','fuelCap','avgL100km','avgKmL','avgCO2','avgCo2Class','data4','instantLph','instantL100km','instantKmL','instantCO2','co2Class','instantHistory','instantKmLHistory','data6','tripAvgL100km','tripAvgKmL','tripAvgCO2','tripTotalCO2','tripTotalNOx','tripCo2Class','data8','data9'];
    fields.forEach(f => {
      assert.notStrictEqual($scope[f], '', `${f} empty`);
    });
  });

  it('computes trip average from overall history', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = {
      getItem: key => key === 'okFuelEconomyOverall'
        ? JSON.stringify({ queue: [400, 600, 800], co2Queue: [9568, 14352, 19136], distance: 123, fuelUsedLiquid: 0, fuelUsedElectric: 0, tripCo2: 1765.296 })
        : null,
      setItem: () => {}
    };
    global.performance = { now: (() => { let t = 0; return () => { t += 1000; return t; }; })() };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, trip: 0, throttle_input: 0, rpmTacho: 0 } };
    streams.engineInfo[11] = 50; streams.engineInfo[12] = 60;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripAvgL100km, '600.0 L/100km');
    assert.strictEqual($scope.tripAvgCO2, '14352 g/km');
    assert.strictEqual($scope.tripCo2Class, 'G');
    assert.notStrictEqual($scope.tripAvgHistory, '');
    assert.notStrictEqual($scope.tripAvgKmLHistory, '');
    assert.notStrictEqual($scope.tripAvgL100km, $scope.avgL100km);
  });

  it('recovers trip average quickly after long idle', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    const idle = 0.25;
    const store = {
      okFuelEconomyOverall: JSON.stringify({
        queue: Array(20000).fill(idle).concat([20, 30, 40, 50]),
        distance: 0,
        fuelUsedLiquid: 0,
        fuelUsedElectric: 0,
        tripCostLiquid: 0,
        tripCostElectric: 0,
        tripDistanceLiquid: 0,
        tripDistanceElectric: 0
      }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: () => {} };
    global.performance = { now: (() => { let t = 0; return () => { t += 1000; return t; }; })() };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0, trip: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripAvgL100km, '30.0 L/100km');
  });

  it('caps avg and trip efficiency history at 100 km/L', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => { now += 1000; return now; } };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 20, trip: 0, throttle_input: 0, rpmTacho: 1000 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    // first update establishes baseline without consumption
    $scope.on_streamsUpdate(null, streams);

    // second update with tiny fuel usage yielding >100 km/L if unclamped
    streams.engineInfo[11] = 49.99998;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.avgKmLHistory, '0.0,8.0 100.0,0.0');
    assert.strictEqual($scope.tripAvgKmLHistory, '0.0,8.0 100.0,0.0');
  });

  it('throttles instant consumption updates', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {};
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, trip: 5, throttle_input: 0, rpmTacho: 1000 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    const first = $scope.instantLph;
    const firstCO2 = $scope.instantCO2;

    now = 100;
    $scope.on_streamsUpdate(null, streams);
    assert.equal($scope.instantLph, first);
    assert.equal($scope.instantCO2, firstCO2);

    now = 300;
    $scope.on_streamsUpdate(null, streams);
    assert.notStrictEqual($scope.instantLph, first);
    assert.notStrictEqual($scope.instantCO2, firstCO2);
  });

  it('resets instant consumption when engine stops', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    now = 300;
    streams.engineInfo[11] = 49.99;
    $scope.on_streamsUpdate(null, streams);
    assert.notStrictEqual($scope.instantLph, '0.0 L/h');
    assert.notStrictEqual($scope.instantHistory, '');
    assert.notStrictEqual($scope.instantKmLHistory, '');
    assert.notStrictEqual($scope.instantCO2, '0 g/km');
    assert.notStrictEqual($scope.co2Class, '');

    streams.electrics.rpmTacho = 0;
    streams.electrics.throttle_input = 0;
    streams.electrics.wheelspeed = 0;
    streams.electrics.airspeed = 0;
    now = 600;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.instantLph, '0.0 L/h');
    assert.strictEqual($scope.instantL100km, '0.0 L/100km');
    assert.strictEqual($scope.instantKmL, '100.00 km/L');
    assert.strictEqual($scope.instantHistory, '');
    assert.strictEqual($scope.instantKmLHistory, '');
    assert.strictEqual($scope.instantCO2, '0 g/km');
    assert.strictEqual($scope.co2Class, 'A');
  });

  it('caps instant efficiency when coasting', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    now = 1000;
    streams.engineInfo[11] = 49.99;
    $scope.on_streamsUpdate(null, streams);

    streams.electrics.throttle_input = 0;
    for (let i = 0; i < 100; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }

    const val = parseFloat($scope.instantKmL);
    assert.notStrictEqual($scope.instantKmLHistory, '');
    assert.ok(val <= 100, `instantKmL not capped: ${$scope.instantKmL}`);
  });


  it('reports finite efficiency when idling at a standstill', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {};
    global.localStorage = {
      getItem: () => null,
      setItem: (k, v) => {
        store[k] = v;
      }
    };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);

    now = 1000;
    streams.engineInfo[11] = 49.99;
    $scope.on_streamsUpdate(null, streams);

    streams.electrics.wheelspeed = 0;
    streams.electrics.airspeed = 0;
    streams.electrics.throttle_input = 0;
    streams.engineInfo[11] = 49.98;
    now = 2000;
    $scope.on_streamsUpdate(null, streams);

    const eff = parseFloat($scope.instantKmL);
    assert.ok(Number.isFinite(eff) && eff > 0 && eff <= 100);

    const saved = JSON.parse(store.okFuelEconomyInstantEffHistory);
    const last = saved.queue[saved.queue.length - 1];
    assert.ok(Number.isFinite(last) && last <= 100);
  });

  it('resets instant history when vehicle changes', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    now = 300;
    streams.engineInfo[11] = 49.99;
    $scope.on_streamsUpdate(null, streams);
    assert.notStrictEqual($scope.instantHistory, '');
    assert.notStrictEqual($scope.instantKmLHistory, '');

    $scope.on_VehicleFocusChanged();

    assert.strictEqual($scope.instantHistory, '');
    assert.strictEqual($scope.instantKmLHistory, '');
  });

  it('resets avg history when measured distance resets', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {};
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, airspeed: 10, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    now = 1000;
    streams.engineInfo[11] = 49.995; // consume 0.005 L over 10 m
    $scope.on_streamsUpdate(null, streams);
    now = 2000;
    streams.engineInfo[11] = 49.99; // consume another 0.005 L
    $scope.on_streamsUpdate(null, streams);
    assert.notStrictEqual($scope.avgHistory, '');
    assert.notStrictEqual($scope.avgKmLHistory, '');

    const overallBefore = JSON.parse(store.okFuelEconomyOverall);
    const avgBefore = JSON.parse(store.okFuelEconomyAvgHistory);
    assert.ok(overallBefore.queue.length > 0);
    assert.ok(avgBefore.queue.length > 1);

    streams.engineInfo[11] = 60; // fuel reset -> distance reset
    now = 3000;
    $scope.on_streamsUpdate(null, streams);

      assert.strictEqual($scope.avgHistory, '');
      assert.strictEqual($scope.avgKmLHistory, '');
      const avgAfter = JSON.parse(store.okFuelEconomyAvgHistory);
      const overallAfter = JSON.parse(store.okFuelEconomyOverall);
      assert.equal(avgAfter.queue.length, 1);
      assert.equal(overallAfter.queue.length, overallBefore.queue.length + 1);
  });

  it('skips history updates when engine is off', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 5, previousAvgTrip: 5, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => { now += 100; return now; } };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0, trip: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    for (let i = 0; i < 5; i++) {
      $scope.on_streamsUpdate(null, streams);
    }

    assert.strictEqual($scope.tripAvgHistory, '');
    assert.strictEqual($scope.avgHistory, '');
    assert.strictEqual($scope.instantHistory, '');
  });

  it('pauses history and cost updates when the engine is off', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
    streams.engineInfo[11] = 60;
    streams.engineInfo[12] = 80;

    for (let i = 0; i < 3; i++) {
      now += 1000;
      streams.engineInfo[11] -= 0.1;
      $scope.on_streamsUpdate(null, streams);
    }

    const avgHist = $scope.avgHistory;
    const tripHist = $scope.tripAvgHistory;
    const tripCost = $scope.tripAvgCostLiquid;
    const instHist = $scope.instantHistory;

    streams.electrics.rpmTacho = 0;
    streams.electrics.throttle_input = 0;
    streams.electrics.wheelspeed = 5;

    for (let i = 0; i < 5; i++) {
      now += 1000;
      streams.engineInfo[11] -= 0.05;
      $scope.on_streamsUpdate(null, streams);
    }

    assert.strictEqual($scope.avgHistory, '');
    assert.strictEqual($scope.tripAvgHistory, tripHist);
    assert.strictEqual($scope.tripAvgCostLiquid, tripCost);
    assert.strictEqual($scope.instantHistory, '');
  });

  it('continues updates when engineRunning flag is false but rpm is high', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 10, throttle_input: 0.5, rpmTacho: 1000, engineRunning: true, trip: 0 }
    };
    streams.engineInfo[11] = 60;
    streams.engineInfo[12] = 80;

    for (let i = 0; i < 3; i++) {
      now += 1000;
      streams.engineInfo[11] -= 0.1;
      $scope.on_streamsUpdate(null, streams);
    }

    streams.electrics.engineRunning = false;
    streams.electrics.throttle_input = 0;
    streams.electrics.wheelspeed = 5;
    streams.electrics.rpmTacho = 800;

    for (let i = 0; i < 5; i++) {
      now += 1000;
      streams.engineInfo[11] -= 0.05;
      $scope.on_streamsUpdate(null, streams);
    }

    assert.ok(parseFloat($scope.instantLph) > 0);
    assert.ok(parseFloat($scope.instantCO2) > 0);
  });

  it('pauses updates when rpm is below threshold without engineRunning flag', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 10, throttle_input: 0.5, rpmTacho: 1000, trip: 0 }
    };
    streams.engineInfo[11] = 60;
    streams.engineInfo[12] = 80;
    streams.engineInfo[13] = 90;

    for (let i = 0; i < 3; i++) {
      now += 1000;
      streams.engineInfo[11] -= 0.1;
      $scope.on_streamsUpdate(null, streams);
    }

    streams.electrics.rpmTacho = 50;
    streams.electrics.throttle_input = 0;
    streams.electrics.wheelspeed = 0;

    for (let i = 0; i < 5; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }

    assert.ok(parseFloat($scope.instantLph) < 0.5);
    assert.ok(parseFloat($scope.instantCO2) < 4);
  });

  it('stops updating when ignition is off in electric mode', () => {
    let directiveDef;
    global.angular = {
      module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }),
    };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({
        queue: [],
        distance: 0,
        previousAvg: 0,
        previousAvgTrip: 0,
        fuelUsedLiquid: 0,
        fuelUsedElectric: 0,
      }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] }),
    };
    global.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = v;
      },
    };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = {
      $on: (name, cb) => {
        $scope['on_' + name] = cb;
      },
      $evalAsync: (fn) => fn(),
    };
    controllerFn({ debug: () => {} }, $scope);
    $scope.unitMode = 'electric';

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: {
        wheelspeed: 10,
        throttle_input: 0.5,
        rpmTacho: 1000,
        engineRunning: true,
        ignitionLevel: 2,
        trip: 0,
      },
    };
    streams.engineInfo[11] = 60;
    streams.engineInfo[12] = 80;

    for (let i = 0; i < 3; i++) {
      now += 1000;
      streams.engineInfo[11] -= 0.1;
      $scope.on_streamsUpdate(null, streams);
    }

    streams.electrics.ignitionLevel = 0;
    streams.electrics.engineRunning = false;
    streams.electrics.wheelspeed = 0;
    streams.electrics.throttle_input = 0;
    streams.electrics.rpmTacho = 0;

    for (let i = 0; i < 3; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }

    assert.strictEqual($scope.instantHistory, '');
  });

  it('ignores unrealistic consumption spikes while stationary', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0, trip: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.reset();

    now = 1000;
    $scope.on_streamsUpdate(null, streams); // engine off snapshot

    now = 2000;
    streams.electrics.rpmTacho = 1000;
    streams.electrics.throttle_input = 0.5;
    streams.engineInfo[11] = 49.999;
    $scope.on_streamsUpdate(null, streams); // high consumption while stationary

    assert.strictEqual($scope.tripAvgHistory, '');
    assert.strictEqual($scope.avgHistory, '');

    now = 3000;
    streams.electrics.wheelspeed = 10;
    streams.electrics.airspeed = 10;
    streams.engineInfo[11] = 49.99;
    $scope.on_streamsUpdate(null, streams); // start moving

    const overall = JSON.parse(store.okFuelEconomyOverall);
    const avg = JSON.parse(store.okFuelEconomyAvgHistory);
    assert.equal(overall.queue.length, 2);
    assert.equal(avg.queue.length, 2);
    assert.ok(overall.queue[0] < 1000);
    assert.ok(avg.queue[0] < 1000);
  });

  it('requires EU speed window for CO2 compliance', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, engineRunning: false, trip: 0 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.reset();

    now = 10000;
    $scope.on_streamsUpdate(null, streams); // engine off, time passes
    assert.strictEqual($scope.avgCo2Compliant, false);

    now = 11000;
    streams.electrics.engineRunning = true;
    streams.electrics.wheelspeed = 10;
    streams.electrics.airspeed = 10;
    $scope.on_streamsUpdate(null, streams); // within speed window
    assert.strictEqual($scope.avgCo2Compliant, true);

    now = 11001;
    streams.electrics.wheelspeed = 40;
    streams.electrics.airspeed = 40;
    $scope.on_streamsUpdate(null, streams); // exceeds EU top speed
    assert.strictEqual($scope.avgCo2Compliant, false);

    // return to compliant speeds and flush the overspeed sample
    streams.electrics.wheelspeed = 10;
    streams.electrics.airspeed = 10;
    for (let i = 0; i < 11; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }
    assert.strictEqual($scope.avgCo2Compliant, true);

    // overspeed again and ensure compliance can return once more
    now += 1000;
    streams.electrics.wheelspeed = 40;
    streams.electrics.airspeed = 40;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.avgCo2Compliant, false);

    streams.electrics.wheelspeed = 10;
    streams.electrics.airspeed = 10;
    for (let i = 0; i < 11; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }
    assert.strictEqual($scope.avgCo2Compliant, true);
  });

  it('drops EU compliance after an extended stop lowers average speed below 18 km/h', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, engineRunning: true, trip: 0 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.reset();

    // drive at compliant speed for 5 s
    streams.electrics.wheelspeed = 11.11;
    streams.electrics.airspeed = 11.11;
    for (let i = 0; i < 5; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }
    assert.strictEqual($scope.avgCo2Compliant, true);

    // stop and let average speed decay below threshold
    streams.electrics.engineRunning = true;
    streams.electrics.wheelspeed = 0;
    streams.electrics.airspeed = 0;
    for (let i = 0; i < 10; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }
    assert.strictEqual($scope.avgCo2Compliant, false);
  });

  it('clears EU compliance after the engine is shut off and average speed decays', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, engineRunning: true, trip: 0 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.reset();

    // drive at compliant speed for 5 s
    streams.electrics.wheelspeed = 11.11;
    streams.electrics.airspeed = 11.11;
    for (let i = 0; i < 5; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }
    assert.strictEqual($scope.avgCo2Compliant, true);

    // turn off engine and let average speed decay
    streams.electrics.engineRunning = false;
    streams.electrics.wheelspeed = 0;
    streams.electrics.airspeed = 0;
    for (let i = 0; i < 10; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }
    assert.strictEqual($scope.avgCo2Compliant, false);
  });

  it('recovers EU compliance after a brief overspeed followed by extended cruising', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, engineRunning: true, trip: 0 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.reset();

    for (let i = 0; i < 10; i++) {
      now += 1000;
      streams.electrics.wheelspeed = 10;
      streams.electrics.airspeed = 10;
      $scope.on_streamsUpdate(null, streams);
    }
    assert.strictEqual($scope.avgCo2Compliant, true);

    now += 1000;
    streams.electrics.wheelspeed = 40;
    streams.electrics.airspeed = 40;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.avgCo2Compliant, false);

    streams.electrics.wheelspeed = 15;
    streams.electrics.airspeed = 15;
    for (let i = 0; i < 20; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams);
    }
    assert.strictEqual($scope.avgCo2Compliant, true);
  });

  it('uses wheelspeed when airspeed is missing to determine EU compliance', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 0, throttle_input: 0, engineRunning: false, trip: 0 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.reset();

    now = 10000;
    $scope.on_streamsUpdate(null, streams); // initialize timers

    now = 11000;
    streams.electrics.engineRunning = true;
    streams.electrics.wheelspeed = 10;
    delete streams.electrics.airspeed; // absent airspeed sensor
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.avgCo2Compliant, true);
  });

  it('marks EU compliant even when CO2 exceeds 120 g/km if speeds are valid', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, engineRunning: false, trip: 0 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.reset();

    // seed starting fuel with engine off
    now = 0;
    $scope.on_streamsUpdate(null, streams);

    // drive at 10 m/s consuming 0.05 L over 10 m -> high but finite CO2
    now = 1000;
    streams.electrics.engineRunning = true;
    streams.electrics.wheelspeed = 10;
    streams.electrics.airspeed = 10;
    streams.engineInfo[11] = 49.95;
    $scope.on_streamsUpdate(null, streams);

    assert.ok(parseFloat($scope.avgCO2) > 120);
    assert.strictEqual($scope.avgCo2Compliant, true);
  });

  it('restores EU compliance after flushing idle samples', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, engineRunning: true, trip: 0 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.reset();

    for (let i = 0; i < 100; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams); // idle with zero speed
    }
    assert.strictEqual($scope.avgCo2Compliant, false);

    streams.electrics.wheelspeed = 11.11;
    streams.electrics.airspeed = 11.11;
    for (let i = 0; i < 4; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams); // not enough samples yet
    }
    assert.strictEqual($scope.avgCo2Compliant, false);

    for (let i = 0; i < 6; i++) {
      now += 1000;
      $scope.on_streamsUpdate(null, streams); // accumulate compliant speeds
    }
    assert.strictEqual($scope.avgCo2Compliant, true);
  });

});

  it('binds average and instant histories to correct graphs', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const fs = require('node:fs');
    const path = require('node:path');
    const tpl = fs.readFileSync(path.join(__dirname, '..', 'okFuelEconomy', directiveDef.templateUrl), 'utf8');
    assert.ok(
      /Average history:[\s\S]*\{\{\s*fuelType === 'Food' \? instantHistory : avgHistory\s*\}\}/.test(
        tpl
      )
    );
    assert.ok(
      /Instant \{\{ unitFlowUnit \}\} history:[\s\S]*\{\{\s*fuelType === 'Food' \? avgHistory : instantHistory\s*\}\}/.test(
        tpl
      )
    );
  });

  describe('visibility settings persistence', () => {
  it('saves and restores user choices', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {};
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    global.performance = { now: () => 0 };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];

    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);

    assert.equal($scope.visible.heading, true);
    $scope.visible.heading = false;
    $scope.visible.fuelLeft = false;
    $scope.visible.instantLph = false;
    $scope.visible.instantGraph = false;
    $scope.visible.instantCO2 = false;
    $scope.visible.avgCO2 = false;
    $scope.visible.tripAvgCO2 = false;
    $scope.visible.tripTotalCO2 = false;
    $scope.visible.tripTotalNOx = false;
    $scope.saveSettings();

    assert.ok(store.okFuelEconomyVisible.includes('"heading":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"fuelLeft":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"instantLph":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"instantGraph":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"instantCO2":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"avgCO2":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"tripAvgCO2":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"tripTotalCO2":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"tripTotalNOx":false'));

    const $scope2 = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope2);
    assert.equal($scope2.visible.heading, false);
    assert.equal($scope2.visible.fuelLeft, false);
    assert.equal($scope2.visible.instantLph, false);
    assert.equal($scope2.visible.instantGraph, false);
    assert.equal($scope2.visible.instantCO2, false);
    assert.equal($scope2.visible.avgCO2, false);
    assert.equal($scope2.visible.tripAvgCO2, false);
    assert.equal($scope2.visible.tripTotalCO2, false);
    assert.equal($scope2.visible.tripTotalNOx, false);
    assert.equal($scope2.visible.fuelUsed, true);
  });
});
