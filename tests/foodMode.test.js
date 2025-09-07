const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub angular
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  simulateFood,
  FOOD_CAPACITY_KCAL,
  MIN_VALID_SPEED_MPS,
  shouldResetOnFoot
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('Food mode simulation', () => {
  it('consumes energy at rest', () => {
    const res = simulateFood(0, 3600, FOOD_CAPACITY_KCAL, 0);
    const used = FOOD_CAPACITY_KCAL - res.remaining;
    assert.ok(used > 70 && used < 90);
  });

  it('increases consumption with activity', () => {
    const walk = simulateFood(1.5, 1, FOOD_CAPACITY_KCAL, 0);
    const run = simulateFood(3.0, 1, FOOD_CAPACITY_KCAL, 0.5);
    assert.ok(run.rate > walk.rate);
    assert.ok(walk.instPer100km < 1000);
    assert.ok(run.instPer100km < 1000);
  });

  it('oscillates pseudo-randomly around baseline', () => {
    const r1 = simulateFood(0, 1, FOOD_CAPACITY_KCAL, 0).rate;
    const r2 = simulateFood(0, 1, FOOD_CAPACITY_KCAL, 1).rate;
    assert.notStrictEqual(r1, r2);
    assert.ok(r1 > 70 && r1 < 90);
    assert.ok(r2 > 70 && r2 < 90);
  });

  it('applies food price to cost calculations', () => {
    const price = 0.01; // currency per kcal
    const res = simulateFood(1, 3600, FOOD_CAPACITY_KCAL, 0);
    const used = FOOD_CAPACITY_KCAL - res.remaining;
    const totalCost = used * price;
    const avgCost = (res.instPer100km / 100) * price;
    assert.ok(totalCost > 0);
    assert.ok(avgCost > 0);
  });

  it('accumulates total cost across updates', () => {
    const price = 0.02;
    let remaining = FOOD_CAPACITY_KCAL;
    let prev = 0;
    for (let t = 0; t < 5; t++) {
      const step = simulateFood(1, 60, remaining, t);
      remaining = step.remaining;
      const cost = (FOOD_CAPACITY_KCAL - remaining) * price;
      assert.ok(cost > prev);
      prev = cost;
    }
  });

  it('uses hourly rate when nearly stationary', () => {
    const res = simulateFood(MIN_VALID_SPEED_MPS / 2, 1, FOOD_CAPACITY_KCAL, 0);
    assert.strictEqual(res.instPer100km, res.rate / 4);
  });

  it('resets only when switching to food fuel type', () => {
    assert.strictEqual(shouldResetOnFoot('Gasoline', 'Food'), true);
    assert.strictEqual(shouldResetOnFoot('Food', 'Food'), false);
    assert.strictEqual(shouldResetOnFoot('Food', 'Gasoline'), false);
  });
});
