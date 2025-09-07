const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub angular
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  simulateFood,
  FOOD_CAPACITY_KCAL,
  MIN_VALID_SPEED_MPS
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('Food mode simulation', () => {
  it('consumes energy at rest', () => {
    const res = simulateFood(0, 3600, FOOD_CAPACITY_KCAL, 0);
    // base rest rate 80 kcal/h
    assert.ok(Math.abs(res.remaining - (FOOD_CAPACITY_KCAL - 80)) < 1e-6);
  });

  it('increases consumption with activity', () => {
    const walk = simulateFood(1.5, 1, FOOD_CAPACITY_KCAL, 0);
    const run = simulateFood(3.0, 1, FOOD_CAPACITY_KCAL, 0);
    assert.ok(run.rate > walk.rate);
    assert.ok(walk.instPer100km < 1000);
    assert.ok(run.instPer100km < 1000);
  });

  it('uses hourly rate when nearly stationary', () => {
    const res = simulateFood(MIN_VALID_SPEED_MPS / 2, 1, FOOD_CAPACITY_KCAL, 0);
    assert.strictEqual(res.instPer100km, res.rate / 4);
  });
});
