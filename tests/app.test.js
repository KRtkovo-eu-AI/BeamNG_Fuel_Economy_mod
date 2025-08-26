const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  smoothFuelFlow,
  trimQueue,
  calculateRange,
  buildQueueGraphPoints,
  resolveSpeed,
  formatDistance,
  formatVolume,
  formatConsumptionRate,
  formatEfficiency,
  formatFlow
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
    it('returns negative when fuel increases (refuel)', () => {
      assert.strictEqual(calculateFuelFlow(12, 10, 2), -1);
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
    it('propagates negative fuel flow', () => {
      assert.strictEqual(
        calculateInstantConsumption(-0.001, 10),
        -0.001 / 10 * 100000
      );
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
    it('empties queue when maxEntries is zero', () => {
      const queue = [1, 2, 3];
      trimQueue(queue, 0);
      assert.deepStrictEqual(queue, []);
    });
  });

  describe('smoothFuelFlow', () => {
    const EPS_SPEED = 0.005;
    it('retains last flow when throttle applied but fuel reading static', () => {
      const last = 0.01;
      const res = smoothFuelFlow(0, 5, 0.6, last, 0.002, EPS_SPEED);
      assert.strictEqual(res, last);
    });
    it('uses idle flow when coasting with zero throttle', () => {
      const last = 0.03;
      const idle = 0.005;
      const res = smoothFuelFlow(0, 5, 0, last, idle, EPS_SPEED);
      assert.ok(res < last);
    });
    it('updates to new positive flow', () => {
      const res = smoothFuelFlow(0.02, 5, 0.7, 0.01, 0.005, EPS_SPEED);
      assert.strictEqual(res, 0.02);
    });
    it('moves toward idle when stopped', () => {
      const res = smoothFuelFlow(0, 0, 0, 0.01, 0.005, EPS_SPEED);
      assert.ok(res < 0.01);
      assert.ok(res > 0.005);
    });
    it('eases towards idle while coasting', () => {
      const idle = 0.005;
      let last = 0.02;
      const flow1 = smoothFuelFlow(0, 20, 0, last, idle, EPS_SPEED);
      const flow2 = smoothFuelFlow(0, 20, 0, flow1, idle, EPS_SPEED);
      assert.ok(flow1 < last);
      assert.ok(flow2 < flow1);
      assert.ok(flow2 > idle);
    });
    it('decays when idle is unknown', () => {
      let last = 0.03;
      const flow1 = smoothFuelFlow(0, 25, 0, last, 0, EPS_SPEED);
      const flow2 = smoothFuelFlow(0, 25, 0, flow1, 0, EPS_SPEED);
      assert.ok(flow1 < last);
      assert.ok(flow2 < flow1);
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
    it('treats negative avg as no consumption while moving', () => {
      assert.strictEqual(calculateRange(10, -5, 1, EPS_SPEED), Infinity);
    });
    it('treats negative avg as no consumption while stopped', () => {
      assert.strictEqual(calculateRange(10, -5, 0, EPS_SPEED), 0);
    });
  });

  describe('buildQueueGraphPoints', () => {
    it('returns empty string for short queues', () => {
      assert.strictEqual(buildQueueGraphPoints([1], 100, 40), '');
    });
    it('scales values to width and height', () => {
      const pts = buildQueueGraphPoints([0, 100], 100, 40);
      assert.strictEqual(pts, '0.0,40.0 100.0,0.0');
    });
    it('handles intermediate values', () => {
      const pts = buildQueueGraphPoints([0, 50, 100], 100, 40);
      assert.strictEqual(pts, '0.0,40.0 50.0,20.0 100.0,0.0');
    });
    it('handles zero max values', () => {
      assert.strictEqual(buildQueueGraphPoints([0, 0], 100, 40), '');
    });
  });

  describe('resolveSpeed', () => {
    const EPS_SPEED = 0.005;
    it('zeroes wheel speed when airspeed indicates standing still', () => {
      const s = resolveSpeed(10, 0, EPS_SPEED);
      assert.strictEqual(s, 0);
    });
    it('prevents distance growth while stationary', () => {
      const dt = 1;
      let distance = 0;
      distance += resolveSpeed(15, 0, EPS_SPEED) * dt;
      assert.strictEqual(distance, 0);
    });
    it('prefers airspeed when available', () => {
      const s = resolveSpeed(5, 8, EPS_SPEED);
      assert.strictEqual(s, 8);
    });
    it('falls back to wheel speed when airspeed missing', () => {
      const s = resolveSpeed(7, undefined, EPS_SPEED);
      assert.strictEqual(s, 7);
    });
  });

  describe('unit formatting', () => {
    it('formats metric distance', () => {
      assert.strictEqual(formatDistance(1000, 'metric', 1), '1.0 km');
    });
    it('formats imperial volume', () => {
      assert.strictEqual(formatVolume(3.78541, 'imperial', 2), '1.00 gal');
    });
    it('formats electric consumption', () => {
      assert.strictEqual(
        formatConsumptionRate(10, 'electric', 1),
        '10.0 kWh/100km'
      );
    });
    it('formats imperial efficiency', () => {
      assert.strictEqual(formatEfficiency(10, 'imperial', 2), '23.52 mi/gal');
    });
    it('formats flow in kW', () => {
      assert.strictEqual(formatFlow(5, 'electric', 1), '5.0 kW');
    });
  });
});
