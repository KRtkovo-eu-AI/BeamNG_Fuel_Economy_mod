const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(store = { okFuelEconomyVisible: JSON.stringify({ webEndpoint: true }) }) {
  let directiveDef;
  global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
  global.StreamsManager = { add: () => {}, remove: () => {} };
  global.UiUnits = { buildString: () => '' };
  const calls = [];
  global.bngApi = {
    engineLua: (cmd, cb) => {
      calls.push(cmd);
      if (typeof cb === 'function') {
        if (cmd.includes('start')) cb(23512);
        else cb('');
      }
    }
  };
  global.localStorage = { getItem: (k) => store[k] || null, setItem: (k,v) => { store[k]=v; } };
  global.performance = { now: (() => { let t = 0; return () => { t += 1000; return t; }; })() };

  delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
  require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
  const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
  const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: (fn) => fn() };
  controllerFn({ debug: () => {} }, $scope);
  return { calls, $scope };
}

test('starts web server when enabled', () => {
  const { calls, $scope } = setup();
  assert.ok(calls.includes('extensions.load("okWebServer")'));
  assert.ok(calls.includes('extensions.okWebServer.start()'));
  assert.strictEqual($scope.webEndpointRunning, true);
});

test('exposes server port', () => {
  const { calls, $scope } = setup();
  assert.strictEqual($scope.webEndpointPort, 23512);
  assert.ok(calls.includes('extensions.load("okWebServer")'));
  assert.ok(calls.includes('extensions.okWebServer.start()'));
});

test('updates web server with latest data', () => {
  const { calls, $scope } = setup();
  calls.length = 0;
  $scope.fuelType = 'Gasoline';
  const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 1000, trip: 0 } };
  streams.engineInfo[11] = 50;
  streams.engineInfo[12] = 60;
  $scope.on_streamsUpdate(null, streams);
  const call = calls.find((c) => c.startsWith('extensions.okWebServer.setData('));
  assert.ok(call);
  const arg = call.match(/setData\((.*)\)/)[1];
  const jsonStr = JSON.parse(arg);
  const payload = JSON.parse(jsonStr);
  assert.ok(payload.hasOwnProperty('tripTotalCO2'));
  assert.ok(payload.tripTotalCO2.hasOwnProperty('value'));
  assert.ok(payload.tripTotalCO2.hasOwnProperty('unit'));
  assert.ok(payload.hasOwnProperty('instantCO2'));
  assert.ok(payload.instantCO2.hasOwnProperty('value'));
  assert.ok(payload.instantCO2.hasOwnProperty('unit'));
  assert.ok(payload.hasOwnProperty('tripDistance'));
  assert.ok(payload.tripDistance.hasOwnProperty('value'));
  assert.ok(payload.tripDistance.hasOwnProperty('unit'));
  assert.ok(payload.hasOwnProperty('tripRange'));
  assert.ok(payload.tripRange.hasOwnProperty('value'));
  assert.ok(payload.tripRange.hasOwnProperty('unit'));
  assert.ok(payload.hasOwnProperty('avgCo2Class'));
  assert.strictEqual(payload.gameStatus, 'running');
  assert.strictEqual(payload.gameIsPaused, 0);
  assert.ok(payload.hasOwnProperty('fuelType'));
  assert.ok(payload.settings);
  assert.ok(payload.settings.visible);
  assert.ok(Object.prototype.hasOwnProperty.call(payload.settings, 'rowOrder'));
  assert.strictEqual(payload.settings.useCustomStyles, true);
  assert.strictEqual(payload.settings.unitMode, 'metric');
});

test('payload marks paused state', () => {
  const { calls, $scope } = setup();
  calls.length = 0;
  $scope.gamePaused = true;
  const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 1000, trip: 0 } };
  streams.engineInfo[11] = 50;
  streams.engineInfo[12] = 60;
  $scope.on_streamsUpdate(null, streams);
  const call = calls.find((c) => c.startsWith('extensions.okWebServer.setData('));
  assert.ok(call);
  const arg = call.match(/setData\((.*)\)/)[1];
  const payload = JSON.parse(JSON.parse(arg));
  assert.strictEqual(payload.gameStatus, 'paused');
  assert.strictEqual(payload.gameIsPaused, 1);
});

test('web endpoint reflects pause toggles', () => {
  const { calls, $scope } = setup();
  calls.length = 0;
  $scope.on_streamsUpdate(null, { okGameState: { paused: true } });
  let call = calls.find((c) => c.startsWith('extensions.okWebServer.setData('));
  assert.ok(call);
  let payload = JSON.parse(JSON.parse(call.match(/setData\((.*)\)/)[1]));
  assert.strictEqual(payload.gameIsPaused, 1);

  calls.length = 0;
  $scope.on_streamsUpdate(null, { okGameState: { paused: false } });
  call = calls.find((c) => c.startsWith('extensions.okWebServer.setData('));
  assert.ok(call);
  payload = JSON.parse(JSON.parse(call.match(/setData\((.*)\)/)[1]));
  assert.strictEqual(payload.gameIsPaused, 0);
});

test('migrates legacy trip visibility flags', () => {
  const store = { okFuelEconomyVisible: JSON.stringify({ webEndpoint: true, tripFuelUsed: true, tripTotalCost: true, tripAvgCost: true }) };
  const { $scope } = setup(store);
  assert.strictEqual($scope.visible.tripFuelUsedLiquid, true);
  assert.strictEqual($scope.visible.tripFuelUsedElectric, true);
  assert.strictEqual($scope.visible.tripTotalCostLiquid, true);
  assert.strictEqual($scope.visible.tripTotalCostElectric, true);
  assert.strictEqual($scope.visible.tripAvgCostLiquid, true);
  assert.strictEqual($scope.visible.tripAvgCostElectric, true);
});

test('payload honors unit preferences', () => {
  const store = {
    okFuelEconomyVisible: JSON.stringify({ webEndpoint: true }),
    okFuelEconomyUnitMode: 'imperial'
  };
  const { calls, $scope } = setup(store);
  calls.length = 0;
  $scope.fuelType = 'Gasoline';
  const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 1000, trip: 0 } };
  streams.engineInfo[11] = 50;
  streams.engineInfo[12] = 60;
  $scope.on_streamsUpdate(null, streams);
  const call = calls.find((c) => c.startsWith('extensions.okWebServer.setData('));
  assert.ok(call);
  const payload = JSON.parse(JSON.parse(call.match(/setData\((.*)\)/)[1]));
  assert.strictEqual(payload.distanceMeasured.unit, 'mi');
  assert.strictEqual(payload.settings.unitMode, 'imperial');
});

test('payload exposes kcal units for food mode', () => {
  const store = {
    okFuelEconomyVisible: JSON.stringify({ webEndpoint: true }),
    okFuelEconomyUnitMode: 'food'
  };
  const { calls, $scope } = setup(store);
  calls.length = 0;
  $scope.fuelType = 'Food';
  const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0, trip: 0 } };
  streams.engineInfo[11] = 50;
  streams.engineInfo[12] = 60;
  $scope.on_streamsUpdate(null, streams);
  const call = calls.find((c) => c.startsWith('extensions.okWebServer.setData('));
  assert.ok(call);
  const payload = JSON.parse(JSON.parse(call.match(/setData\((.*)\)/)[1]));
  assert.strictEqual(payload.fuelUsed.unit, 'kcal');
  assert.strictEqual(payload.settings.unitMode, 'food');
});

test('lua web server exposes ui.html', () => {
  const content = fs.readFileSync('okFuelEconomy/lua/ge/extensions/okWebServer.lua', 'utf8');
  assert.ok(content.includes('ui.html'));
  assert.ok(content.includes('dataRows'));
  assert.ok(content.includes('tr.trip'));
  assert.ok(content.includes('#ffa64d'));
  assert.ok(content.includes('#FFE7CC'));
  assert.ok(content.includes("f.label+': '"));
  assert.ok(content.includes('lastOrder'));
  assert.ok(content.includes('Used'));
  assert.ok(content.includes('Measured'));
  assert.ok(content.includes('row-averageConsumption'));
  assert.ok(content.includes('Trip fuel used'));
  assert.ok(content.includes('Trip total fuel cost'));
  assert.ok(content.includes('row-tripAvgConsumption'));
  assert.ok(content.includes('Trip average fuel cost'));
  assert.ok(content.includes('Trip total CO₂ emissions'));
  assert.ok(content.includes('Trip total NOₓ emissions'));
  assert.ok(content.includes('Trip average CO₂ emissions'));
  assert.ok(content.includes('avgCo2Class'));
  assert.ok(content.includes('tripCo2Class'));
  assert.ok(content.includes('settings.json'));
  assert.ok(content.includes('webEndpointPort'));
});

test('ui.html respects row order', () => {
  const lua = fs.readFileSync('okFuelEconomy/lua/ge/extensions/okWebServer.lua', 'utf8');
  let script = lua.match(/<script>([\s\S]*?)<\/script>/i)[1];
  script = script.replace('refresh();setInterval(refresh,1000);', '');
  const tbody = {
    children: [],
    appendChild(el) { this.children.push(el); },
    set innerHTML(v) { this.children = []; },
  };
  const sandbox = {
    document: {
      createElement: (tag) => ({ tag, id: '', className: '', children: [], textContent: '', appendChild(el) { this.children.push(el); } }),
      createTextNode: (text) => ({ textContent: text }),
      getElementById: (id) => (id === 'dataRows' ? tbody : null),
      body: {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  sandbox.buildRows({ rowOrder: ['row-tripDistance', 'row-distance'], visible: { tripDistance: true, distanceMeasured: true } });
  const order = tbody.children.map((r) => r.id);
  assert.deepStrictEqual(order.slice(0, 2), ['row-tripDistance', 'row-distance']);
});

test('ui.html hides rows and fields based on visibility settings', () => {
  const lua = fs.readFileSync('okFuelEconomy/lua/ge/extensions/okWebServer.lua', 'utf8');
  let script = lua.match(/<script>([\s\S]*?)<\/script>/i)[1];
  script = script.replace('refresh();setInterval(refresh,1000);', '');
  const tbody = {
    children: [],
    appendChild(el) { this.children.push(el); },
    set innerHTML(v) { this.children = []; },
  };
  const sandbox = {
    document: {
      createElement: (tag) => ({ tag, id: '', className: '', children: [], textContent: '', appendChild(el) { this.children.push(el); } }),
      createTextNode: (text) => ({ textContent: text }),
      getElementById: (id) => (id === 'dataRows' ? tbody : null),
      body: {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  sandbox.buildRows({
    visible: { avgL100km: false, avgKmL: false, tripAvgL100km: true, tripAvgKmL: false }
  });
  const ids = tbody.children.map((r) => r.id);
  assert.ok(!ids.includes('row-averageConsumption'));
  const row = tbody.children.find((r) => r.id === 'row-tripAvgConsumption');
  assert.ok(row);
  const td2 = row.children[1];
  const fieldCount = td2.children.filter((c) => c.tag === 'span').length;
  assert.strictEqual(fieldCount, 1);
});

test('ui.html applies custom style and heading visibility', async () => {
  const lua = fs.readFileSync('okFuelEconomy/lua/ge/extensions/okWebServer.lua', 'utf8');
  let script = lua.match(/<script>([\s\S]*?)<\/script>/i)[1];
  script = script.replace('refresh();setInterval(refresh,1000);', '');
  const tbody = {
    children: [],
    appendChild(el) { this.children.push(el); },
    set innerHTML(v) { this.children = []; },
  };
  const heading = { textContent: '', style: {} };
  const sandbox = {
    document: {
      createElement: (tag) => ({ tag, id: '', className: '', children: [], textContent: '', appendChild(el) { this.children.push(el); } }),
      createTextNode: (text) => ({ textContent: text }),
      getElementById: (id) => {
        if (id === 'dataRows') return tbody;
        if (id === 'heading') return heading;
        return null;
      },
      body: { className: '' },
    },
    fetch: async () => ({ json: async () => ({ settings: { visible: { heading: false }, useCustomStyles: false } }) }),
    setInterval: () => {},
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  await sandbox.refresh();
  assert.strictEqual(sandbox.document.body.className, '');
  assert.strictEqual(heading.style.display, 'none');
  sandbox.fetch = async () => ({ json: async () => ({ settings: { visible: { heading: true }, useCustomStyles: true } }) });
  await sandbox.refresh();
  assert.strictEqual(sandbox.document.body.className, 'custom');
  assert.notStrictEqual(heading.style.display, 'none');
});
