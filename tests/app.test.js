const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  smoothFuelFlow,
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
    const res = smoothFuelFlow(0, 5, 0.6, last, 0.002, 1000, 1500, EPS_SPEED);
      assert.strictEqual(res, last);
    });
    it('uses idle flow when coasting with zero throttle', () => {
      const last = 0.03;
      const idle = 0.005;
    const res = smoothFuelFlow(0, 5, 0, last, idle, 800, 800, EPS_SPEED);
      assert.strictEqual(res, idle);
    });
    it('updates to new positive flow', () => {
    const res = smoothFuelFlow(0.02, 5, 0.7, 0.01, 0.005, 800, 1500, EPS_SPEED);
      assert.strictEqual(res, 0.02);
    });
    it('uses idle flow when stopped', () => {
    const res = smoothFuelFlow(0, 0, 0, 0.01, 0.005, 800, 800, EPS_SPEED);
      assert.strictEqual(res, 0.005);
    });
    it('falls back to last flow if idle unknown', () => {
    const res = smoothFuelFlow(0, 5, 0, 0.02, 0, 800, 1200, EPS_SPEED);
      assert.strictEqual(res, 0.02);
    });
    it('keeps instant consumption at idle while coasting', () => {
      const idle = 0.005;
      // step 1: consume fuel while accelerating
      let prev = 10;
      let curr = 9.9;
      const dt = 1;
      const speed = 10;
      const flow = calculateFuelFlow(curr, prev, dt); // 0.1
      // step 2: coasting, fuel reading unchanged
      prev = curr;
      curr = 9.9;
      let flow2 = calculateFuelFlow(curr, prev, dt); // 0
      flow2 = smoothFuelFlow(flow2, speed, 0, flow, idle, 800, 1200, EPS_SPEED); // should use idle scaled by rpm
      const inst = calculateInstantConsumption(flow2, speed);
      assert.strictEqual(flow2, idle * (1200 / 800));
      assert.ok(inst > 0);
    });

    it('scales idle flow by rpm while coasting', () => {
      const idle = 0.01;
      const idleRpm = 800;
      const rpm = 1600;
      const last = 0.02;
      const res = smoothFuelFlow(0, 10, 0, last, idle, idleRpm, rpm, EPS_SPEED);
      assert.strictEqual(res, idle * (rpm / idleRpm));
    });

    it('scales idle flow even when rpm falls below idle', () => {
      const idle = 0.01;
      const idleRpm = 1000;
      const rpm = 700;
      const last = 0.02;
      const res = smoothFuelFlow(0, 10, 0, last, idle, idleRpm, rpm, EPS_SPEED);
      assert.strictEqual(res, idle * (rpm / idleRpm));
    });

    it('updates flow each frame as rpm changes while coasting', () => {
      const idle = 0.01;
      const idleRpm = 800;
      const speed = 10;
      let last = 0.02;
      const flow1 = smoothFuelFlow(0, speed, 0, last, idle, idleRpm, 2000, EPS_SPEED);
      last = flow1;
      const flow2 = smoothFuelFlow(0, speed, 0, last, idle, idleRpm, 1500, EPS_SPEED);
      assert.strictEqual(flow1, idle * (2000 / idleRpm));
      assert.strictEqual(flow2, idle * (1500 / idleRpm));
      assert.notStrictEqual(flow1, flow2);
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
});
