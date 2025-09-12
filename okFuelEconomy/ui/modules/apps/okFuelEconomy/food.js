const {
  MIN_VALID_SPEED_MPS,
  FOOD_RUN_KCAL_PER_H,
  FOOD_WALK_KCAL_PER_H,
  FOOD_REST_KCAL_PER_H,
  MAX_EFFICIENCY
} = require('./constants');
const { buildQueueGraphPoints, trimQueue } = require('./calc');

let foodBaseRate;

function resetFoodSimulation() {
  foodBaseRate = undefined;
}

function simulateFood(speed_mps, dtSeconds, energy_kcal, timeSeconds) {
  var state = 'rest';
  if (speed_mps >= 2.5) state = 'run';
  else if (speed_mps >= 0.5) state = 'walk';
  var target =
    state === 'run'
      ? FOOD_RUN_KCAL_PER_H
      : state === 'walk'
      ? FOOD_WALK_KCAL_PER_H
      : FOOD_REST_KCAL_PER_H;
  if (foodBaseRate == null) foodBaseRate = target;
  var blend = Math.min(dtSeconds / 5, 1);
  foodBaseRate += (target - foodBaseRate) * blend;
  var t = timeSeconds || 0;
  function noise(seed) {
    var x = Math.sin((t + seed) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }
  var freqBase = state === 'run' ? 2.4 : state === 'walk' ? 1.8 : 1.2;
  var freq = freqBase * (1 + (noise(0) - 0.5) * 0.1);
  var beat = Math.pow(0.5 + 0.5 * Math.sin(t * freq * 2 * Math.PI), 8);
  var amp = 0.25 + (noise(1) - 0.5) * 0.05;
  var jitter = 1 + (noise(2) - 0.5) * 0.02;
  var rate = foodBaseRate * jitter * (1 + beat * amp); // kcal/h
  var used = (rate / 3600) * dtSeconds;
  var remaining = Math.max(0, energy_kcal - used);
  var speed = Math.abs(speed_mps);
  var instPer100km;
  var efficiency = 0;
  if (speed <= MIN_VALID_SPEED_MPS) {
    instPer100km = rate / 4;
  } else {
    var speed_kmph = speed * 3.6;
    instPer100km = (rate / speed_kmph) * 10;
    efficiency = instPer100km > 0 ? 100 / instPer100km : 0; // km per kcal
  }
  return {
    remaining: remaining,
    rate: rate,
    instPer100km: instPer100km,
    efficiency: efficiency
  };
}

function updateFoodHistories(
  $scope,
  res,
  now_ms,
  instantHistory,
  instantEffHistory,
  avgHistory,
  saveInstantHistory,
  saveInstantEffHistory,
  saveAvgHistory,
  INSTANT_MAX_ENTRIES,
  AVG_MAX_ENTRIES
) {
  instantHistory.queue.push(res.rate);
  trimQueue(instantHistory.queue, INSTANT_MAX_ENTRIES);
  $scope.instantHistory = buildQueueGraphPoints(instantHistory.queue, 100, 40);
  instantEffHistory.queue.push(
    Number.isFinite(res.efficiency) ? Math.min(res.efficiency, MAX_EFFICIENCY) : MAX_EFFICIENCY
  );
  trimQueue(instantEffHistory.queue, INSTANT_MAX_ENTRIES);
  var effMax = Math.max.apply(null, instantEffHistory.queue);
  $scope.instantKmLHistory = buildQueueGraphPoints(
    instantEffHistory.queue.map(function (v) {
      return effMax - v;
    }),
    100,
    40
  );
  if (!instantHistory.lastSaveTime) instantHistory.lastSaveTime = 0;
  if (now_ms - instantHistory.lastSaveTime >= 100) {
    saveInstantHistory();
    instantHistory.lastSaveTime = now_ms;
  }
  if (!instantEffHistory.lastSaveTime) instantEffHistory.lastSaveTime = 0;
  if (now_ms - instantEffHistory.lastSaveTime >= 100) {
    saveInstantEffHistory();
    instantEffHistory.lastSaveTime = now_ms;
  }

  avgHistory.queue.push(res.instPer100km);
  trimQueue(avgHistory.queue, AVG_MAX_ENTRIES);
  $scope.avgHistory = buildQueueGraphPoints(avgHistory.queue, 100, 40);
  $scope.avgKmLHistory = buildQueueGraphPoints(
    avgHistory.queue.map(function (v) {
      return v > 0 ? Math.min(100 / v, MAX_EFFICIENCY) : MAX_EFFICIENCY;
    }),
    100,
    40
  );
  if (!avgHistory.lastSaveTime) avgHistory.lastSaveTime = 0;
  if (now_ms - avgHistory.lastSaveTime >= 100) {
    saveAvgHistory();
    avgHistory.lastSaveTime = now_ms;
  }
}

module.exports = {
  simulateFood,
  resetFoodSimulation,
  updateFoodHistories
};
