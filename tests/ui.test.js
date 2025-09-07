const assert = require('node:assert');
const { describe, it } = require('node:test');

describe('UI integration', () => {
  it('applies visibility from settings.json', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    let json = JSON.stringify({ order: [], visible: { heading: false, fuelLeft: false, instantLph: false } });
    global.bngApi = { engineLua: (code, cb) => cb(json) };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    const dummyEl = { appendChild: () => {}, insertBefore: () => {} };
    global.document = { getElementById: () => dummyEl };
    global.window = {};

    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = {
      $on: (event, cb) => { $scope['on_' + event] = cb; },
      $evalAsync: fn => fn()
    };
    controllerFn({ debug: () => {} }, $scope);

    assert.equal($scope.visible.heading, false);
    assert.equal($scope.visible.fuelLeft, false);
    assert.equal($scope.visible.instantLph, false);

    json = JSON.stringify({ order: [], visible: { heading: true, fuelLeft: true, instantLph: true } });
    window.reloadFuelEconomySettings();
    assert.equal($scope.visible.heading, true);
    assert.equal($scope.visible.fuelLeft, true);
    assert.equal($scope.visible.instantLph, true);

    if ($scope.on_$destroy) $scope.on_$destroy();
  });
});
