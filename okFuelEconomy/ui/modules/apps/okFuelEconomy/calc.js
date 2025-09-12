const {
  MIN_VALID_SPEED_MPS,
  MIN_RPM_RUNNING,
  DEFAULT_IDLE_FLOW_LPS,
  DEFAULT_IDLE_RPM,
  MAX_CONSUMPTION,
  MAX_ELECTRIC_CONSUMPTION,
  RADPS_TO_RPM
} = require('./constants');

function calculateFuelFlow(currentFuel, previousFuel, dtSeconds) {
  if (dtSeconds <= 0 || previousFuel === null) return 0;
  return (previousFuel - currentFuel) / dtSeconds; // L/s
}

function normalizeRpm(rpm, engineRunning) {
  if (rpm <= 0) return 0;
  if (engineRunning === false) return rpm * RADPS_TO_RPM;
  return rpm < 300 ? rpm * RADPS_TO_RPM : rpm;
}

function calculateInstantConsumption(fuelFlow_lps, speed_mps, isElectric) {
  var speed = Math.abs(speed_mps);
  var l_per_100km;
  if (speed <= MIN_VALID_SPEED_MPS) {
    // For very low speeds use a quarter of the hourly fuel rate as a
    // per-distance estimate to avoid extreme L/100km values.
    l_per_100km = (fuelFlow_lps * 3600) / 4;
  } else {
    l_per_100km = (fuelFlow_lps / speed) * 100000;
  }
  var max = isElectric ? MAX_ELECTRIC_CONSUMPTION : MAX_CONSUMPTION;
  if (l_per_100km > max) l_per_100km = max;
  return l_per_100km;
}

function smoothFuelFlow(
  fuelFlow_lps,
  speed_mps,
  throttle,
  lastFuelFlow_lps,
  idleFuelFlow_lps,
  idleRpm,
  rpm,
  EPS_SPEED,
  isElectric
) {
  if (isElectric && speed_mps <= EPS_SPEED && throttle <= 0.05) {
    // Electric drivetrains consume no power when stationary.
    return 0;
  }
  if (fuelFlow_lps < 0) {
    // Negative flow means energy is being returned (regen) – use directly.
    return fuelFlow_lps;
  }
  if (fuelFlow_lps > 0) {
    // Always use fresh positive readings, even with zero throttle.
    return fuelFlow_lps;
  }
  var baseIdle = idleFuelFlow_lps > 0 ? idleFuelFlow_lps : DEFAULT_IDLE_FLOW_LPS;
  var baseRpm = idleRpm > 0 ? idleRpm : DEFAULT_IDLE_RPM;
  var currentRpm = rpm;

  if (throttle <= 0.05) {
    // Coasting or idling with a stale sensor reading – scale idle by RPM.
    currentRpm = currentRpm > 0 ? currentRpm : baseRpm;
    return (baseIdle * currentRpm) / baseRpm;
  }

  if (speed_mps > EPS_SPEED) {
    // Throttle applied but sensor static – keep the last flow.
    return lastFuelFlow_lps;
  }

  // Vehicle stopped with throttle: smoothly approach idle or fallback flow.
  return lastFuelFlow_lps + (baseIdle - lastFuelFlow_lps) * 0.1;
}

function trimQueue(queue, maxEntries) {
  while (queue.length > maxEntries) {
    queue.shift();
  }
}

function calculateMedian(queue) {
  if (!Array.isArray(queue) || queue.length === 0) return 0;

  var sorted = queue.slice().sort(function (a, b) { return a - b; });
  var min = sorted[0];
  var threshold = min * 1.05 + 1e-4; // consider values within 5% as idle

  var deduped = [min];
  for (var i = 1; i < sorted.length; i++) {
    if (sorted[i] > threshold) deduped.push(sorted[i]);
  }

  var mid = Math.floor(deduped.length / 2);
  if (deduped.length % 2) return deduped[mid];
  return (deduped[mid - 1] + deduped[mid]) / 2;
}

function calculateAverage(queue) {
  if (!Array.isArray(queue) || queue.length === 0) return 0;
  var sum = 0;
  for (var i = 0; i < queue.length; i++) {
    sum += queue[i];
  }
  return sum / queue.length;
}

function calculateAverageConsumption(fuelUsed_l, distance_m) {
  if (distance_m <= 0) return 0;
  return (fuelUsed_l / distance_m) * 100000;
}

function calculateRange(currentFuel_l, avg_l_per_100km_ok, speed_mps, EPS_SPEED) {
  if (avg_l_per_100km_ok > 0) {
    return (currentFuel_l / avg_l_per_100km_ok) * 100000;
  }
  return speed_mps > EPS_SPEED ? Infinity : 0;
}

function resolveAverageConsumption(
  engineRunning,
  inst_l_per_100km,
  avgRecent,
  maxEntries,
  allowNegative
) {
  if (engineRunning && (inst_l_per_100km >= 0 || allowNegative)) {
    avgRecent.queue.push(inst_l_per_100km);
    trimQueue(avgRecent.queue, maxEntries);
  } else {
    // Reset recent averages when the engine is not running or when an
    // invalid sample is encountered so stale or refuel events do not
    // introduce bogus values.
    avgRecent.queue = [];
  }
  return calculateAverage(avgRecent.queue);
}

function buildQueueGraphPoints(queue, width, height) {
  if (!Array.isArray(queue) || queue.length < 2) return '';
  var max = Math.max.apply(null, queue);
  if (max <= 0) return '';
  return queue
    .map(function (val, i) {
      var x = (i / (queue.length - 1)) * width;
      var y = height - (val / max) * height;
      return x.toFixed(1) + ',' + y.toFixed(1);
    })
    .join(' ');
}

function resolveSpeed(wheelSpeed_mps, airSpeed_mps, EPS_SPEED) {
  if (Number.isFinite(airSpeed_mps)) {
    return Math.abs(airSpeed_mps) > EPS_SPEED ? airSpeed_mps : 0;
  }
  return Math.abs(wheelSpeed_mps || 0) > EPS_SPEED ? wheelSpeed_mps : 0;
}

function isEngineRunning(electrics, engineInfo) {
  if (electrics) {
    if (typeof electrics.ignitionLevel === 'number') {
      return electrics.ignitionLevel > 1;
    }
    if (typeof electrics.engineRunning === 'boolean') {
      return electrics.engineRunning;
    }
  }
  if (
    Array.isArray(engineInfo) &&
    typeof engineInfo[14] === 'number' &&
    engineInfo[14] !== 0
  ) {
    return engineInfo[14] > 0;
  }
  var rpm = normalizeRpm(
    (electrics && electrics.rpmTacho) || 0,
    electrics && electrics.engineRunning
  );
  return rpm >= MIN_RPM_RUNNING;
}

module.exports = {
  calculateFuelFlow,
  normalizeRpm,
  calculateInstantConsumption,
  smoothFuelFlow,
  trimQueue,
  calculateMedian,
  calculateAverage,
  calculateAverageConsumption,
  calculateRange,
  resolveAverageConsumption,
  buildQueueGraphPoints,
  resolveSpeed,
  isEngineRunning
};
