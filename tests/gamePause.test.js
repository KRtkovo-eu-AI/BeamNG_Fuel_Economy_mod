const assert = require('node:assert');
const { it } = require('node:test');

it('halts updates when the game is paused', () => {
  let directiveDef;
  global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
  global.StreamsManager = { add: () => {}, remove: () => {} };
  // Minimal unit labels builder
  global.UiUnits = {
    buildString: (val, unit) => `${val} ${unit}`
  };
  let paused = false;
  global.bngApi = {
    engineLua: cmd => {
      if (cmd === 'return be:getTimeScale()') {
        return paused ? 0 : 1;
      }
      return '';
    },
    activeObjectLua: (code, cb) => cb(JSON.stringify({ t: 'Gasoline' }))
  };
  global.localStorage = { getItem: () => null, setItem: () => {} };
  let now = 0;
  global.performance = { now: () => now };
  delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
  require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
  const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
  const handlers = {};
  const $scope = { $on: (n, fn) => { handlers[n] = fn; }, $evalAsync: fn => fn() };
  controllerFn({ debug: () => {} }, $scope);
  const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 100, airspeed: 100, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
  streams.engineInfo[11] = 50;
  streams.engineInfo[12] = 60;

  // initial run dt 0
  handlers['streamsUpdate'](null, streams);
  // advance 1 s
  now = 1000;
  handlers['streamsUpdate'](null, streams);
  const before = $scope.data1;
  // pause game and advance another second
  paused = true;
  now = 2000;
  handlers['streamsUpdate'](null, streams);
  assert.strictEqual($scope.data1, before);
  // resume game and advance
  paused = false;
  now = 3000;
  handlers['streamsUpdate'](null, streams);
  assert.notStrictEqual($scope.data1, before);
});
