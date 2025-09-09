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
  const { calls } = setup();
  assert.ok(calls.includes('extensions.load("okWebServer")'));
  assert.ok(calls.includes('extensions.okWebServer.start()'));
});

test('updates web server with latest data', () => {
  const { calls, $scope } = setup();
  calls.length = 0;
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
});
