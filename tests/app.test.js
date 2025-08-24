const assert = require('assert');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  trimQueue,
  calculateRange
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

(function testCalculateFuelFlow() {
  assert.strictEqual(calculateFuelFlow(10, null, 1), 0, 'handles missing previous fuel');
  assert.strictEqual(calculateFuelFlow(10, 12, 0), 0, 'handles non-positive dt');
  assert.strictEqual(calculateFuelFlow(10, 12, 2), 1, 'computes fuel flow');
})();

(function testCalculateInstantConsumption() {
  assert.strictEqual(
    calculateInstantConsumption(0.002, 20),
    0.002 / 20 * 100000,
    'computes instant consumption'
  );
  assert.strictEqual(
    calculateInstantConsumption(0.001, 0),
    Infinity,
    'handles zero speed'
  );
})();

(function testTrimQueue() {
  const queue = [];
  for (let i = 0; i < 10; i++) queue.push(i);
  trimQueue(queue, 5);
  assert.strictEqual(queue.length, 5, 'queue trimmed to max entries');
  assert.deepStrictEqual(queue, [5,6,7,8,9], 'oldest entries removed');
})();

(function testCalculateRange() {
  const EPS_SPEED = 0.005;
  assert.strictEqual(calculateRange(10, 5, 1, EPS_SPEED), 2, 'finite range computed');
  assert.strictEqual(calculateRange(10, 0, 1, EPS_SPEED), Infinity, 'infinite range when moving with zero consumption');
  assert.strictEqual(calculateRange(10, 0, 0, EPS_SPEED), 0, 'zero range when stopped with zero consumption');
})();

console.log('All tests passed');
