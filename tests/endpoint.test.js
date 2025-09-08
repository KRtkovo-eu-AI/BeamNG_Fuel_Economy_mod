const assert = require('node:assert');
const { describe, it } = require('node:test');

async function setupScope() {
  let directiveDef;
  global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
  global.StreamsManager = { add: () => {}, remove: () => {} };
  global.UiUnits = { buildString: () => '' };
  global.window = {};
  global.bngApi = {
    engineLua: (code, cb) => { if (cb) setTimeout(() => cb('{}'), 0); },
    activeObjectLua: (code, cb) => setTimeout(() => cb('{}'), 0)
  };
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.performance = { now: () => 0, markResourceTiming: () => {} };
  delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
  require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
  const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
  const $scope = { $on: () => {}, $evalAsync: fn => fn() };
  controllerFn({ debug: () => {} }, $scope);
  await new Promise(r => setTimeout(r, 0));
  $scope.heading = '0';
  $scope.instantL100km = '0';
  return $scope;
}

describe('localhost endpoint', () => {
  it('serves app html and json data', async () => {
    const $scope = await setupScope();
    $scope.toggleEndpoint();

    const htmlRes = await fetch('http://localhost:8099/');
    const htmlText = await htmlRes.text();
    assert.ok(htmlText.includes('<div class="bngApp"'));

    const dataRes = await fetch('http://localhost:8099/data');
    const json = await dataRes.json();
    assert.ok('heading' in json);
    assert.ok('instantL100km' in json);

    $scope.toggleEndpoint();
    await new Promise(r => setTimeout(r, 0));
  });
});
