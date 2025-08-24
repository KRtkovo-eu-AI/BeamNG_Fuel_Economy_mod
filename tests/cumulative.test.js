const assert = require('assert');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const { calculateFuelFlow } = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('cumulative tracking', function () {
  it('tracks cumulative fuel usage and distance', function () {
    const fuelLevels = [50, 49.9, 49.7, 49.4];
    const dt = 1; // seconds between updates
    const speed = 10; // constant speed m/s

    let prev = fuelLevels[0];
    let totalFuel = 0;
    let totalDistance = 0;

    for (let i = 1; i < fuelLevels.length; i++) {
      const curr = fuelLevels[i];
      const flow = calculateFuelFlow(curr, prev, dt); // L/s
      totalFuel += flow * dt;
      totalDistance += speed * dt;
      prev = curr;
    }

    assert.strictEqual(totalFuel, 0.6);
    assert.strictEqual(totalDistance, 30);
  });
});
