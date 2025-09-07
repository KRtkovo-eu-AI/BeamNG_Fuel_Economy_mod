const assert = require('node:assert');
const { describe, it } = require('node:test');
const { setup } = require('./helpers/mockBeamNG');

describe('BeamNG game environment', () => {
  it('auto-switches to electric units when vehicle is electric', () => {
    const env = setup({ fuelType: 'Electric' });
    const { $scope, activeObjectLuaCalls, cleanup } = env;
    try {
      assert.strictEqual($scope.fuelType, 'Electricity');
      assert.strictEqual($scope.unitMode, 'electric');
      assert.strictEqual($scope.unitConsumptionUnit, 'kWh/100km');
      assert.ok(activeObjectLuaCalls.length > 0);

      const streams = {
        engineInfo: Array(15).fill(0),
        electrics: { wheelspeed: 10, trip: 0, throttle_input: 0.2, rpmTacho: 1000 }
      };
      streams.engineInfo[11] = 50;
      streams.engineInfo[12] = 60;
      $scope.on_streamsUpdate(null, streams);
      assert.notStrictEqual($scope.fuelLeft, '');
    } finally {
      cleanup();
    }
  });
});
