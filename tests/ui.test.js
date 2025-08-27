const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const httpStub = { get: () => Promise.resolve({ data: { fuelPrice: 0, currency: 'money' } }) };

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
    assert.ok(html.includes('fuel price and currency in'));
    assert.ok(html.includes('fuelPrice.json'));
    assert.ok(!html.includes('<script type="text/javascript">'));
    assert.ok(html.includes('{{ costPrice }}'));
    assert.ok(html.includes('{{ avgCost }}'));
    assert.ok(html.includes('{{ totalCost }}'));
    assert.ok(html.includes('{{ tripAvgCost }}'));
    assert.ok(html.includes('{{ tripTotalCost }}'));
  });

  it('toggles fuel price help dialog via controller functions', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    const $http = { get: () => Promise.resolve({ data: {} }) };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope, $http);

    assert.equal($scope.fuelPriceHelpOpen, false);
    $scope.openFuelPriceHelp({ preventDefault() {} });
    assert.equal($scope.fuelPriceHelpOpen, true);
    $scope.closeFuelPriceHelp();
    assert.equal($scope.fuelPriceHelpOpen, false);
  });

  it('exposes fuelPrice and currency in fuelPrice.json', () => {
    const priceConfigPath = path.join(__dirname, '..', 'okFuelEconomy', 'ui', 'modules', 'apps', 'okFuelEconomy', 'fuelPrice.json');
    const cfg = JSON.parse(fs.readFileSync(priceConfigPath, 'utf8'));
    assert.ok(Object.prototype.hasOwnProperty.call(cfg, 'fuelPrice'));
    assert.ok(Object.prototype.hasOwnProperty.call(cfg, 'currency'));
  });


  it('loads fuelPrice from fuelPrice.json via app.js', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    const $http = { get: () => Promise.resolve({ data: { fuelPrice: 2.25, currency: 'CZK' } }) };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope, $http);
    await new Promise(resolve => setImmediate(resolve));

    assert.strictEqual($scope.fuelPriceValue, 2.25);
    assert.strictEqual($scope.currency, 'CZK');
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
    const $http = { get: () => Promise.reject(new Error('missing')) };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope, $http);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;
    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.fuelPriceValue, 0);
    assert.strictEqual($scope.currency, 'money');
    assert.strictEqual($scope.costPrice, '0.00 money/L');
    assert.strictEqual($scope.avgCost, '0.00 money/km');
    assert.strictEqual($scope.totalCost, '0.00 money');
    assert.strictEqual($scope.tripAvgCost, '0.00 money/km');
    assert.strictEqual($scope.tripTotalCost, '0.00 money');
  });

  it('positions reset, style toggle and settings icons consistently', () => {
    const resetAttr = getNgAttrStyle('ng-click="reset($event)"');
    const toggleAttr = getNgAttrStyle('ng-click="useCustomStyles=!useCustomStyles"');
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
    const placeholders = ['data1','fuelUsed','fuelLeft','fuelCap','avgL100km','avgKmL','data4','instantLph','instantL100km','instantKmL','instantHistory','instantKmLHistory','data6','tripAvgL100km','tripAvgKmL','tripAvgHistory','tripAvgKmLHistory','avgHistory','avgKmLHistory','data8','data9','unitDistanceUnit'];
    placeholders.forEach(p => {
      assert.ok(html.includes(`{{ ${p} }}`), `missing ${p}`);
    });
    assert.ok(html.includes('{{ vehicleNameStr }}'));
    assert.ok(html.includes('strong ng-if="visible.heading"'));
    assert.ok(html.includes('ng-click="reset($event)"'));
    assert.ok(html.includes('ng-click="useCustomStyles=!useCustomStyles"'));
    assert.ok(html.includes('ng-click="settingsOpen=!settingsOpen"'));
    assert.ok(html.includes('autorenew'));
    assert.ok(html.includes('palette'));
    assert.ok(html.includes('settings'));
    assert.ok(html.includes('<span class="material-icons"')); 
    assert.ok(html.includes('save</span>'));
  });

  it('allows toggling visibility of heading and subfields', () => {
    assert.ok(html.includes('ng-if="visible.distanceMeasured || visible.distanceEcu"'));
    assert.ok(html.includes('ng-if="visible.fuelUsed || visible.fuelLeft || visible.fuelCap"'));
    assert.ok(html.includes('ng-if="visible.avgL100km || visible.avgKmL"'));
    assert.ok(html.includes('ng-if="visible.instantLph || visible.instantL100km || visible.instantKmL"'));
    assert.ok(html.includes('ng-if="visible.tripAvgL100km || visible.tripAvgKmL"'));
    assert.ok(html.includes('ng-if="visible.instantGraph"'));
    assert.ok(html.includes('ng-if="visible.avgCost"'));
    assert.ok(html.includes('ng-if="visible.tripAvgCost"'));
    assert.ok(html.includes('ng-if="visible.tripTotalCost"'));
    const toggles = ['visible.heading','visible.distanceMeasured','visible.distanceEcu','visible.fuelUsed','visible.fuelLeft','visible.fuelCap','visible.avgL100km','visible.avgKmL','visible.avgGraph','visible.avgKmLGraph','visible.instantLph','visible.instantL100km','visible.instantKmL','visible.instantGraph','visible.instantKmLGraph','visible.tripAvgL100km','visible.tripAvgKmL','visible.tripGraph','visible.tripKmLGraph','visible.costPrice','visible.avgCost','visible.totalCost','visible.tripAvgCost','visible.tripTotalCost'];
    toggles.forEach(t => {
      assert.ok(html.includes(`ng-model="${t}"`), `missing toggle ${t}`);
    });
  });
});

describe('controller integration', () => {
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
    controllerFn({ debug: () => {} }, $scope, httpStub);

    assert.strictEqual($scope.visible.costPrice, false);
    assert.strictEqual($scope.visible.avgCost, false);
    assert.strictEqual($scope.visible.totalCost, false);
    assert.strictEqual($scope.visible.tripAvgCost, false);
    assert.strictEqual($scope.visible.tripTotalCost, false);
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
    const $http = { get: () => Promise.resolve({ data: { fuelPrice: 1.5, currency: 'USD' } }) };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope, $http);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;
    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.costPrice, '1.50 USD/L');
    assert.strictEqual($scope.avgCost, '0.15 USD/km');
    assert.strictEqual($scope.totalCost, '3.00 USD');
    assert.strictEqual($scope.tripAvgCost, '0.15 USD/km');
    assert.strictEqual($scope.tripTotalCost, '3.00 USD');
  });

  it('tracks trip fuel usage for total cost', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, fuelUsed: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };
    const $http = { get: () => Promise.resolve({ data: { fuelPrice: 1.5, currency: 'USD' } }) };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope, $http);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    const stored = JSON.parse(store.okFuelEconomyOverall);
    assert.ok(Math.abs(stored.fuelUsed - 2) < 1e-6);
    assert.strictEqual($scope.tripTotalCost, '3.00 USD');

    $scope.resetOverall();
    const storedAfter = JSON.parse(store.okFuelEconomyOverall);
    assert.strictEqual(storedAfter.fuelUsed, 0);
    assert.strictEqual($scope.tripTotalCost, '');
  });

  it('retains trip total cost across vehicle changes', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (t, v, p) => (v.toFixed ? v.toFixed(p) : String(v)) };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, fuelUsed: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };
    const $http = { get: () => Promise.resolve({ data: { fuelPrice: 1.5, currency: 'USD' } }) };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope, $http);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 200, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 58;
    now = 100000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripTotalCost, '3.00 USD');

    streams.engineInfo[11] = 70; streams.engineInfo[12] = 90;
    now = 200000;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCost, '3.00 USD');

    $scope.on_VehicleFocusChanged();

    streams.engineInfo[11] = 70;
    now = 250000;
    $scope.on_streamsUpdate(null, streams);

    streams.engineInfo[11] = 69;
    now = 300000;
    $scope.on_streamsUpdate(null, streams);
    assert.strictEqual($scope.tripTotalCost, '4.50 USD');

    const stored = JSON.parse(store.okFuelEconomyOverall);
    assert.ok(Math.abs(stored.fuelUsed - 3) < 1e-6);
  });

  it('ignores zero fuel reading when engine stops', async () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: (type, val, prec) => (val.toFixed ? val.toFixed(prec) : String(val)) };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, fuelUsed: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };
    const $http = { get: () => Promise.resolve({ data: { fuelPrice: 32.5, currency: 'money' } }) };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope, $http);
    await new Promise(resolve => setImmediate(resolve));

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, trip: 0, throttle_input: 0.5, rpmTacho: 1000 } };
    streams.engineInfo[11] = 70; streams.engineInfo[12] = 80;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 69;
    now = 1000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripTotalCost, '32.50 money');

    streams.electrics.rpmTacho = 0;
    streams.electrics.throttle_input = 0;
    streams.engineInfo[11] = 0;
    now = 2000;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripTotalCost, '32.50 money');
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
    controllerFn({ debug: () => {} }, $scope, httpStub);

    const streams = {
      engineInfo: Array(15).fill(0),
      electrics: { wheelspeed: 10, trip: 5, throttle_input: 0.5, rpmTacho: 1000 }
    };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    $scope.on_streamsUpdate(null, streams);
    streams.engineInfo[11] = 49.9;
    $scope.on_streamsUpdate(null, streams);

    const fields = ['data1','fuelUsed','fuelLeft','fuelCap','avgL100km','avgKmL','data4','instantLph','instantL100km','instantKmL','instantHistory','instantKmLHistory','data6','tripAvgL100km','tripAvgKmL','data8','data9'];
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
        ? JSON.stringify({ queue: [400, 600, 800], distance: 123, fuelUsed: 0 })
        : null,
      setItem: () => {}
    };
    global.performance = { now: (() => { let t = 0; return () => { t += 1000; return t; }; })() };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope, httpStub);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, trip: 0, throttle_input: 0, rpmTacho: 0 } };
    streams.engineInfo[11] = 50; streams.engineInfo[12] = 60;
    $scope.on_streamsUpdate(null, streams);

    assert.strictEqual($scope.tripAvgL100km, '600.0 L/100km');
    assert.notStrictEqual($scope.tripAvgHistory, '');
    assert.notStrictEqual($scope.tripAvgKmLHistory, '');
    assert.notStrictEqual($scope.tripAvgL100km, $scope.avgL100km);
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
    controllerFn({ debug: () => {} }, $scope, httpStub);

    const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 10, trip: 5, throttle_input: 0 } };
    streams.engineInfo[11] = 50;
    streams.engineInfo[12] = 60;

    now = 0;
    $scope.on_streamsUpdate(null, streams);
    const first = $scope.instantLph;

    now = 100;
    $scope.on_streamsUpdate(null, streams);
    assert.equal($scope.instantLph, first);

    now = 300;
    $scope.on_streamsUpdate(null, streams);
    assert.notStrictEqual($scope.instantLph, first);
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
    controllerFn({ debug: () => {} }, $scope, httpStub);

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
    controllerFn({ debug: () => {} }, $scope, httpStub);

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

  it('maxes efficiency when idling at a standstill', () => {
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
    controllerFn({ debug: () => {} }, $scope, httpStub);

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
    assert.ok(eff === 100, `expected 100 km/L, got ${$scope.instantKmL}`);

    const saved = JSON.parse(store.okFuelEconomyInstantEffHistory);
    const last = saved.queue[saved.queue.length - 1];
    assert.strictEqual(last, 100);
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
    controllerFn({ debug: () => {} }, $scope, httpStub);

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
    controllerFn({ debug: () => {} }, $scope, httpStub);

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
    assert.equal(avgAfter.queue.length, 0);
    assert.equal(overallAfter.queue.length, overallBefore.queue.length);
  });

  it('skips history updates when engine is off', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 5, previousAvgTrip: 5, fuelUsed: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => { now += 100; return now; } };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope, httpStub);

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

  it('ignores unrealistic consumption spikes while stationary', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    const store = {
      okFuelEconomyOverall: JSON.stringify({ queue: [], distance: 0, previousAvg: 0, previousAvgTrip: 0, fuelUsed: 0 }),
      okFuelEconomyAvgHistory: JSON.stringify({ queue: [] })
    };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k,v) => { store[k] = v; } };
    let now = 0;
    global.performance = { now: () => now };

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => fn() };
    controllerFn({ debug: () => {} }, $scope, httpStub);

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
    assert.equal(overall.queue.length, 1);
    assert.equal(avg.queue.length, 1);
    assert.ok(overall.queue[0] < 1000);
    assert.ok(avg.queue[0] < 1000);
  });
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
    controllerFn({ debug: () => {} }, $scope, httpStub);

    assert.equal($scope.visible.heading, true);
    $scope.visible.heading = false;
    $scope.visible.fuelLeft = false;
    $scope.visible.instantLph = false;
    $scope.visible.instantGraph = false;
    $scope.saveSettings();

    assert.ok(store.okFuelEconomyVisible.includes('"heading":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"fuelLeft":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"instantLph":false'));
    assert.ok(store.okFuelEconomyVisible.includes('"instantGraph":false'));

    const $scope2 = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope2, httpStub);
    assert.equal($scope2.visible.heading, false);
    assert.equal($scope2.visible.fuelLeft, false);
    assert.equal($scope2.visible.instantLph, false);
    assert.equal($scope2.visible.instantGraph, false);
    assert.equal($scope2.visible.fuelUsed, true);
  });
});
