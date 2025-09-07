const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub angular
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  simulateFood,
  FOOD_CAPACITY_KCAL,
  MIN_VALID_SPEED_MPS,
  shouldResetOnFoot,
  resolveFuelType,
  updateFoodHistories
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
    assert.ok(walk.efficiency > run.efficiency);
  });

  it('shows heartbeat-like pulses at rest', () => {
    const base = simulateFood(0, 1, FOOD_CAPACITY_KCAL, 0).rate;
    const rates = [];
    for (let t = 0; t < 5; t += 0.1) {
      rates.push(simulateFood(0, 0.1, FOOD_CAPACITY_KCAL, t).rate);
    }
    const peaks = rates.filter((r) => r > base * 1.2);
    assert.ok(peaks.length >= 3);
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

  it('ignores empty fuel-type readings', () => {
    assert.strictEqual(resolveFuelType('Food', ''), 'Food');
    assert.strictEqual(resolveFuelType('Gasoline', undefined), 'Gasoline');
  });

  it('records instant and average histories', () => {
    const $scope = {};
    let remaining = FOOD_CAPACITY_KCAL;
    const instantHistory = { queue: [] };
    const instantEffHistory = { queue: [] };
    const avgHistory = { queue: [] };
    const res1 = simulateFood(0, 1, remaining, 0); // standing
    remaining = res1.remaining;
    const res2 = simulateFood(1, 1, remaining, 1); // walking
    updateFoodHistories(
      $scope,
      res1,
      0,
      instantHistory,
      instantEffHistory,
      avgHistory,
      () => {},
      () => {},
      () => {},
      1000,
      1000,
      100
    );
    updateFoodHistories(
      $scope,
      res2,
      1,
      instantHistory,
      instantEffHistory,
      avgHistory,
      () => {},
      () => {},
      () => {},
      1000,
      1000,
      100
    );
    assert.strictEqual(instantHistory.queue.length, 2);
    assert.strictEqual(avgHistory.queue.length, 2);
    assert.ok($scope.instantHistory.length > 0);
    assert.ok($scope.avgHistory.length > 0);
  });

  it('plots higher efficiency lower on the instant graph', () => {
    const $scope = {};
    let remaining = FOOD_CAPACITY_KCAL;
    const instantHistory = { queue: [] };
    const instantEffHistory = { queue: [] };
    const avgHistory = { queue: [] };
    const res1 = simulateFood(0, 1, remaining, 0); // standing
    remaining = res1.remaining;
    const res2 = simulateFood(1.5, 1, remaining, 1); // walking
    updateFoodHistories(
      $scope,
      res1,
      0,
      instantHistory,
      instantEffHistory,
      avgHistory,
      () => {},
      () => {},
      () => {},
      1000,
      1000,
      100
    );
    updateFoodHistories(
      $scope,
      res2,
      1,
      instantHistory,
      instantEffHistory,
      avgHistory,
      () => {},
      () => {},
      () => {},
      1000,
      1000,
      100
    );
    const ys = $scope.instantKmLHistory
      .split(' ')
      .map((p) => parseFloat(p.split(',')[1]));
    assert.ok(ys[1] > ys[0]);
  });
});
