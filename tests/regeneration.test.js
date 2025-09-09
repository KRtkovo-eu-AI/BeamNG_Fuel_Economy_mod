const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  smoothFuelFlow,
  resolveAverageConsumption
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

function pseudoRandom(seed) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

describe('regeneration scenario', () => {
  it('produces negative instant consumption during regenerative braking', () => {
    const rand = pseudoRandom(42);
    const dt = 1;
    const EPS_SPEED = 0.005;
    let previousFuel = 50;
    let lastFlow = 0;
    let idleFlow = 0;
    let sawRegen = false;

    for (let i = 0; i < 200; i++) {
      const r = rand();
      let throttle, speed, delta;
      if (r < 0.25) {
        throttle = 0.5;
        speed = 5 + rand() * 10;
        delta = -0.001 - rand() * 0.002;
      } else if (r < 0.5) {
        throttle = 0;
        speed = 5 + rand() * 10;
        delta = -0.0001 * rand();
      } else if (r < 0.75) {
        throttle = 1;
        speed = 10 + rand() * 20;
        delta = -0.003 - rand() * 0.003;
      } else {
        throttle = 0;
        speed = 5 + rand() * 10;
        delta = 0.002 + rand() * 0.002;
      }

      const currentFuel = previousFuel + delta;
      const rawFlow = calculateFuelFlow(currentFuel, previousFuel, dt);
      const flow = smoothFuelFlow(
        rawFlow,
        speed,
        throttle,
        lastFlow,
        idleFlow,
        800,
        2000,
        EPS_SPEED
      );
      const inst = calculateInstantConsumption(flow, speed);

      if (rawFlow < 0) {
        assert.ok(inst < 0, 'regeneration should yield negative consumption');
        sawRegen = true;
      }

      previousFuel = currentFuel;
      lastFlow = flow;
    }

    assert.ok(sawRegen, 'expected at least one regenerative event');
  });

  it('keeps negative averages for electric regeneration', () => {
    const avgRecent = { queue: [] };
    const result = resolveAverageConsumption(
      true,
      -2,
      avgRecent,
      10,
      true
    );
    assert.strictEqual(result, -2);
    assert.deepStrictEqual(avgRecent.queue, [-2]);
  });
});
