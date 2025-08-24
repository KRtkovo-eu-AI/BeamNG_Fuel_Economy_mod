const assert = require('assert');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  trimQueue,
  calculateRange
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('app.js utility functions', function () {
  describe('calculateFuelFlow', function () {
    it('handles missing previous fuel', function () {
      assert.strictEqual(calculateFuelFlow(10, null, 1), 0);
    });
    it('handles non-positive dt', function () {
      assert.strictEqual(calculateFuelFlow(10, 12, 0), 0);
    });
    it('computes fuel flow', function () {
      assert.strictEqual(calculateFuelFlow(10, 12, 2), 1);
    });
  });

  describe('calculateInstantConsumption', function () {
    it('computes instant consumption', function () {
      assert.strictEqual(
        calculateInstantConsumption(0.002, 20),
        0.002 / 20 * 100000
      );
    });
    it('handles zero speed', function () {
      assert.strictEqual(
        calculateInstantConsumption(0.001, 0),
        Infinity
      );
    });
  });

  describe('trimQueue', function () {
    it('trims oldest entries to max size', function () {
      const queue = [];
      for (let i = 0; i < 10; i++) queue.push(i);
      trimQueue(queue, 5);
      assert.strictEqual(queue.length, 5);
      assert.deepStrictEqual(queue, [5, 6, 7, 8, 9]);
    });
  });

  describe('calculateRange', function () {
    const EPS_SPEED = 0.005;
    it('computes finite range when consuming fuel', function () {
      assert.strictEqual(calculateRange(10, 5, 1, EPS_SPEED), 2);
    });
    it('computes infinite range when moving without consumption', function () {
      assert.strictEqual(calculateRange(10, 0, 1, EPS_SPEED), Infinity);
    });
    it('computes zero range when stopped without consumption', function () {
      assert.strictEqual(calculateRange(10, 0, 0, EPS_SPEED), 0);
    });
  });
});
