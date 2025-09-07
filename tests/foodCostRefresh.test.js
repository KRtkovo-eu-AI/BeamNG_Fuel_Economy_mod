const assert = require('node:assert');
const { describe, it } = require('node:test');

describe('Food cost refresh', () => {
  it('preserves cost values when refreshing in food mode', () => {
    let directiveDef;
    global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.window = {};
    global.bngApi = { engineLua: () => {} };
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.performance = { now: () => 0 };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    const app = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: () => {} };
    controllerFn({ debug: () => {} }, $scope);
    $scope.unitMode = 'food';
    $scope.liquidFuelPriceValue = 0.01;
    $scope.currency = '$';
    $scope.totalCost = '5.00 $';
    $scope.avgCost = '0.50 $/km';
    app.refreshCostOutputs();
    assert.strictEqual($scope.totalCost, '5.00 $');
    assert.strictEqual($scope.avgCost, '0.50 $/km');
  });
});
