const test = require('node:test');
const assert = require('node:assert/strict');

function setup() {
  let directiveDef;
  global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
  global.StreamsManager = { add: () => {}, remove: () => {} };
  global.UiUnits = { buildString: () => '' };
  const calls = [];
  global.bngApi = { engineLua: (cmd) => { calls.push(cmd); return ''; } };
  const store = { okFuelEconomyVisible: JSON.stringify({ webEndpoint: true }) };
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

test('updates web server with latest data', () => {
  const { calls, $scope } = setup();
  calls.length = 0;
  $scope.fuelType = 'Gasoline';
  const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0, trip: 0 } };
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
  assert.strictEqual(payload.gameStatus, 'running');
  assert.strictEqual(payload.gameIsPaused, 0);
  assert.ok(payload.hasOwnProperty('fuelType'));
  assert.ok(payload.settings);
  assert.ok(payload.settings.visible);
  assert.ok(Object.prototype.hasOwnProperty.call(payload.settings, 'rowOrder'));
  assert.strictEqual(payload.settings.useCustomStyles, true);
});

test('payload marks paused state', () => {
  const { calls, $scope } = setup();
  calls.length = 0;
  $scope.gamePaused = true;
  const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 0, airspeed: 0, throttle_input: 0, rpmTacho: 0, trip: 0 } };
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

test('lua web server exposes ui.html', () => {
  const fs = require('node:fs');
  const content = fs.readFileSync('okFuelEconomy/lua/ge/extensions/okWebServer.lua', 'utf8');
  assert.ok(content.includes('ui.html'));
  assert.ok(content.includes('dataRows'));
});
