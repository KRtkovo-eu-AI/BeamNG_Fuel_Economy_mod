const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  calculateAverageConsumption,
  trimQueue,
  calculateRange
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('app.js utility functions', () => {
  describe('calculateFuelFlow', () => {
    it('handles missing previous fuel', () => {
      assert.strictEqual(calculateFuelFlow(10, null, 1), 0);
    });
    it('handles non-positive dt', () => {
      assert.strictEqual(calculateFuelFlow(10, 12, 0), 0);
    });
    it('computes fuel flow', () => {
      assert.strictEqual(calculateFuelFlow(10, 12, 2), 1);
    });
  });

  describe('calculateInstantConsumption', () => {
    it('computes instant consumption', () => {
      assert.strictEqual(
        calculateInstantConsumption(0.002, 20),
        0.002 / 20 * 100000
      );
    });
    it('handles zero speed', () => {
      assert.strictEqual(
        calculateInstantConsumption(0.001, 0),
        Infinity
      );
    });
  });

  describe('calculateAverageConsumption', () => {
    it('computes avg consumption for fuel and distance', () => {
      const avg = calculateAverageConsumption(0.5, 1000); // 0.5 L over 1km
      assert.ok(Math.abs(avg - 50) < 1e-9);
    });
    it('returns 0 when distance is non-positive', () => {
      assert.strictEqual(calculateAverageConsumption(1, 0), 0);
    });
  });

  describe('trimQueue', () => {
    it('trims oldest entries to max size', () => {
      const queue = [];
      for (let i = 0; i < 10; i++) queue.push(i);
      trimQueue(queue, 5);
      assert.strictEqual(queue.length, 5);
      assert.deepStrictEqual(queue, [5, 6, 7, 8, 9]);
    });
  });

  describe('calculateRange', () => {
    const EPS_SPEED = 0.005;
    it('computes finite range when consuming fuel', () => {
      assert.strictEqual(calculateRange(10, 5, 1, EPS_SPEED), 2);
    });
    it('computes infinite range when moving without consumption', () => {
      assert.strictEqual(calculateRange(10, 0, 1, EPS_SPEED), Infinity);
    });
    it('computes zero range when stopped without consumption', () => {
      assert.strictEqual(calculateRange(10, 0, 0, EPS_SPEED), 0);
    });

    it('uses per-meter averages when given per-100km values', () => {
      // 0.5 L over 1 km -> 50 L/100km -> 0.0005 L/m
      const avg100 = calculateAverageConsumption(0.5, 1000);
      const range = calculateRange(10, avg100 / 100000, 1, EPS_SPEED);
      assert.strictEqual(range, 20000);
    });
  });
});
