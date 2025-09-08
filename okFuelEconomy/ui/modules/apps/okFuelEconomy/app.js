// Treat speeds below EPS_SPEED as stationary for general calculations.
// MIN_VALID_SPEED_MPS switches instant consumption to an hourly-rate based
// estimate (hourly fuel rate divided by four) instead of dividing by
// extremely small speeds, keeping idle or creeping readings realistic.
var EPS_SPEED = 0.005; // [m/s]
var MIN_VALID_SPEED_MPS = 1; // ~3.6 km/h
var MIN_RPM_RUNNING = 100; // below this rpm the engine is considered off
var DEFAULT_IDLE_FLOW_LPS = 0.0002; // ~0.72 L/h fallback when idle flow unknown
var DEFAULT_IDLE_RPM = 800; // assume typical idle speed when unknown
// Limit extreme instantaneous consumption figures to keep the display
// within a realistic range even when flooring the throttle from a stop.
var MAX_CONSUMPTION = 100; // [L/100km] ignore unrealistic spikes
var MAX_EFFICIENCY = 100; // [km/L] cap unrealistic efficiency
var RADPS_TO_RPM = 60 / (2 * Math.PI); // convert rad/s telemetry to rpm
var FOOD_CAPACITY_KCAL = 2000;
var FOOD_REST_KCAL_PER_H = 80;
var FOOD_WALK_KCAL_PER_H = 300;
var FOOD_RUN_KCAL_PER_H = 600;
var foodBaseRate;
var EU_SPEED_WINDOW_MS = 10000; // retain EU speed samples for 10 s
var EMISSIONS_BASE_TEMP_C = 90; // baseline engine temp for emissions calculations

var CO2_FACTORS_G_PER_L = {
  Gasoline: 2392,
  Diesel: 2640,
  'LPG/CNG': 1660,
  Electricity: 0,
  Air: 0,
  Ethanol: 1510,
  Hydrogen: 0,
  Nitromethane: 820,
  Nitromethan: 820,
  Food: 0.001, // approx. CO2 from human flatulence per kcal
  Kerosene: 2500,
  'Jet Fuel': 2500,
  Methanol: 1100,
  Biodiesel: 2500,
  Synthetic: 2392,
  'Coal Gas': 2000,
  Steam: 0,
  Ammonia: 0,
  Hybrid: 2392,
  'Plug-in Hybrid': 2392,
  'Fuel Oil': 3100,
  'Heavy Oil': 3100,
  Hydrazine: 0,
  Hypergolic: 0,
  'Solid Rocket': 1900,
  'Black Powder': 1900,
  ACPC: 1900
};

var NOX_FACTORS_G_PER_L = {
  Gasoline: 10,
  Diesel: 20,
  'LPG/CNG': 7,
  Electricity: 0,
  Air: 0,
  Ethanol: 3,
  Hydrogen: 0,
  Nitromethane: 12,
  Nitromethan: 12,
  Food: 0,
  Kerosene: 15,
  'Jet Fuel': 15,
  Methanol: 4,
  Biodiesel: 18,
  Synthetic: 10,
  'Coal Gas': 15,
  Steam: 0,
  Ammonia: 6,
  Hybrid: 10,
  'Plug-in Hybrid': 10,
  'Fuel Oil': 25,
  'Heavy Oil': 25,
  Hydrazine: 30,
  Hypergolic: 30,
  'Solid Rocket': 20,
  'Black Powder': 20,
  ACPC: 20
};

function resetFoodSimulation() {
  foodBaseRate = undefined;
}

function calculateFuelFlow(currentFuel, previousFuel, dtSeconds) {
  if (dtSeconds <= 0 || previousFuel === null) return 0;
  return (previousFuel - currentFuel) / dtSeconds; // L/s
}

function normalizeRpm(rpm, engineRunning) {
  if (rpm <= 0) return 0;
  if (engineRunning === false) return rpm * RADPS_TO_RPM;
  return rpm < 300 ? rpm * RADPS_TO_RPM : rpm;
}

function calculateInstantConsumption(fuelFlow_lps, speed_mps) {
  var speed = Math.abs(speed_mps);
  var l_per_100km;
  if (speed <= MIN_VALID_SPEED_MPS) {
    // For very low speeds use a quarter of the hourly fuel rate as a
    // per-distance estimate to avoid extreme L/100km values.
    l_per_100km = (fuelFlow_lps * 3600) / 4;
  } else {
    l_per_100km = (fuelFlow_lps / speed) * 100000;
  }
  if (l_per_100km > MAX_CONSUMPTION) l_per_100km = MAX_CONSUMPTION;
  return l_per_100km;
}

// Resolve the fuel flow when sensor readings are static.
// - While accelerating (throttle > 0) keep the last measured flow.
// - While coasting or idling with zero throttle and no fresh reading,
//   gradually approach the stored idle flow so the value continues
//   updating instead of snapping to zero.
// - Still allow true zero flow for engine-off or fuel-cut situations
//   when the idle flow is unknown.
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

// Calculate a median that collapses near-idle minimum values to a single
// entry so long idling periods do not skew trip averages for an extended
// time. This assumes the smallest values in the queue correspond to the
// vehicle's idle consumption and treats any reading within ~5% of that
// minimum as the same baseline sample.
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
  maxEntries
) {
  if (engineRunning && inst_l_per_100km >= 0) {
    avgRecent.queue.push(inst_l_per_100km);
    trimQueue(avgRecent.queue, maxEntries);
  } else {
    // Reset recent averages when the engine is not running or when an
    // invalid (negative) sample is encountered so stale or refuel
    // events do not introduce bogus values.
    avgRecent.queue = [];
  }
  return calculateAverage(avgRecent.queue);
}

// Decide which speed value should be used for distance accumulation.
// Prefer the airspeed when available as it represents the vehicle's
// movement relative to the environment. If the airspeed is below the
// epsilon threshold, treat the vehicle as stationary even if the wheels
// are spinning. When no airspeed reading is provided fall back to the
// wheel speed.
function resolveSpeed(wheelSpeed_mps, airSpeed_mps, EPS_SPEED) {
  if (Number.isFinite(airSpeed_mps)) {
    return Math.abs(airSpeed_mps) > EPS_SPEED ? airSpeed_mps : 0;
  }
  return Math.abs(wheelSpeed_mps || 0) > EPS_SPEED ? wheelSpeed_mps : 0;
}

function isEngineRunning(electrics, engineInfo) {
  if (electrics) {
    if (typeof electrics.engineRunning === 'boolean') {
      return electrics.engineRunning;
    }
    if (typeof electrics.ignitionLevel === 'number') {
      return electrics.ignitionLevel > 1;
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
  AVG_MAX_ENTRIES,
  MAX_EFFICIENCY
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


const KM_PER_MILE = 1.60934;
const LITERS_PER_GALLON = 3.78541;

function getUnitLabels(mode) {
  switch (mode) {
    case 'imperial':
      return {
        distance: 'mi',
        volume: 'gal',
        consumption: 'gal/100mi',
        efficiency: 'mi/gal',
        flow: 'gal/h'
      };
    case 'electric':
      return {
        distance: 'km',
        volume: 'kWh',
        consumption: 'kWh/100km',
        efficiency: 'km/kWh',
        flow: 'kW'
      };
    case 'food':
      return {
        distance: 'km',
        volume: 'kcal',
        consumption: 'kcal/100km',
        efficiency: 'km/kcal',
        flow: 'kcal/h'
      };
    default:
      return {
        distance: 'km',
        volume: 'L',
        consumption: 'L/100km',
        efficiency: 'km/L',
        flow: 'L/h'
      };
  }
}

function formatDistance(meters, mode, decimals) {
  if (!Number.isFinite(meters)) return 'Infinity';
  const unit = getUnitLabels(mode).distance;
  let value = meters / 1000;
  if (mode === 'imperial') value = meters / (KM_PER_MILE * 1000) ;
  return value.toFixed(decimals) + ' ' + unit;
}

function formatVolume(liters, mode, decimals) {
  if (!Number.isFinite(liters)) return 'Infinity';
  const unit = getUnitLabels(mode).volume;
  let value = liters;
  if (mode === 'imperial') value = liters / LITERS_PER_GALLON;
  return value.toFixed(decimals) + ' ' + unit;
}

function formatConsumptionRate(lPer100km, mode, decimals) {
  if (!Number.isFinite(lPer100km)) return 'Infinity';
  const unit = getUnitLabels(mode).consumption;
  let value = lPer100km;
  if (mode === 'imperial') value = lPer100km / LITERS_PER_GALLON * KM_PER_MILE;
  return value.toFixed(decimals) + ' ' + unit;
}

function formatEfficiency(kmPerL, mode, decimals) {
  if (!Number.isFinite(kmPerL)) return 'Infinity';
  const unit = getUnitLabels(mode).efficiency;
  let value = kmPerL;
  if (mode === 'imperial') value = kmPerL / KM_PER_MILE * LITERS_PER_GALLON;
  return value.toFixed(decimals) + ' ' + unit;
}

function formatFlow(lPerHour, mode, decimals) {
  if (!Number.isFinite(lPerHour)) return 'Infinity';
  const unit = getUnitLabels(mode).flow;
  let value = lPerHour;
  if (mode === 'imperial') value = lPerHour / LITERS_PER_GALLON;
  return value.toFixed(decimals) + ' ' + unit;
}

function convertVolumeToUnit(liters, mode) {
  return mode === 'imperial' ? liters / LITERS_PER_GALLON : liters;
}

function convertDistanceToUnit(meters, mode) {
  return mode === 'imperial' ? meters / (KM_PER_MILE * 1000) : meters / 1000;
}

function convertVolumePerDistance(lPerKm, mode) {
  return mode === 'imperial'
    ? (lPerKm * KM_PER_MILE) / LITERS_PER_GALLON
    : lPerKm;
}

function calculateCO2Factor(fuelType, engineTempC, n2oActive, isElectric) {
  if (isElectric) return 0;
  var base = CO2_FACTORS_G_PER_L[fuelType] != null
    ? CO2_FACTORS_G_PER_L[fuelType]
    : CO2_FACTORS_G_PER_L.Gasoline;
  var temp =
    typeof engineTempC === 'number' ? engineTempC : EMISSIONS_BASE_TEMP_C;
  if (base === 0) {
    return base;
  }
  var delta = Math.abs(temp - EMISSIONS_BASE_TEMP_C);
  base = base * (1 + delta / 100);
  if (n2oActive) base *= 1.2;
  return base;
}

function calculateCO2gPerKm(lPer100km, fuelType, engineTempC, n2oActive, isElectric) {
  var factor = calculateCO2Factor(fuelType, engineTempC, n2oActive, isElectric);
  if (!Number.isFinite(lPer100km)) return Infinity;
  var capped = Math.min(lPer100km, MAX_CONSUMPTION);
  return (capped / 100) * factor;
}

function calculateNOxFactor(fuelType, engineTempC, n2oActive, isElectric) {
  if (isElectric) return 0;
  var base = NOX_FACTORS_G_PER_L[fuelType] != null
    ? NOX_FACTORS_G_PER_L[fuelType]
    : NOX_FACTORS_G_PER_L.Gasoline;
  var temp = typeof engineTempC === 'number' ? engineTempC : 0;
  var tempExcess = Math.max(0, temp - EMISSIONS_BASE_TEMP_C);
  if (fuelType === 'Hydrogen') {
    base = tempExcess * 0.1;
  } else {
    base = base * (1 + tempExcess / 100);
  }
  if (n2oActive) base *= 1.2;
  return base;
}

function formatCO2(gPerKm, decimals, mode) {
  if (!Number.isFinite(gPerKm)) return 'Infinity';
  var unit = 'g/km';
  var value = gPerKm;
  if (mode === 'imperial') {
    unit = 'g/mi';
    value = gPerKm * KM_PER_MILE;
  }
  return value.toFixed(decimals) + ' ' + unit;
}

function formatMass(total_g) {
  if (!Number.isFinite(total_g) || total_g <= 0) return '';
  if (total_g >= 1000) {
    return (total_g / 1000).toFixed(2) + ' kg';
  }
  return total_g.toFixed(0) + ' g';
}

function classifyCO2(gPerKm) {
  if (!Number.isFinite(gPerKm)) return 'G';
  if (gPerKm <= 120) return 'A';
  if (gPerKm <= 140) return 'B';
  if (gPerKm <= 155) return 'C';
  if (gPerKm <= 170) return 'D';
  if (gPerKm <= 190) return 'E';
  if (gPerKm <= 225) return 'F';
  return 'G';
}

function meetsEuCo2Limit(gPerKm) {
  return Number.isFinite(gPerKm) && gPerKm <= 120;
}

function formatFuelTypeLabel(fuelType) {
  if (typeof fuelType === 'string') {
    var lower = fuelType.toLowerCase();
    if (!lower) {
      return 'None';
    }
    if (lower.indexOf('electric') !== -1) {
      return 'Electricity';
    }
    if (lower === 'compressedgas') {
      return 'LPG/CNG';
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return fuelType || 'None';
}

function resolveUnitModeForFuelType(fuelType, liquidMode) {
  if (typeof fuelType === 'string') {
    var lower = fuelType.toLowerCase();
    if (lower.indexOf('electric') !== -1) {
      return 'electric';
    }
    if (lower === 'food') {
      return 'food';
    }
  }
  return liquidMode;
}

function resolveFuelType(prevType, rawType) {
  if (!rawType) return prevType || '';
  return rawType;
}

function shouldResetOnFoot(prevType, currentType) {
  if (!currentType) return false;
  var lower = currentType.toLowerCase();
  return lower === 'food' && prevType !== currentType;
}

if (typeof module !== 'undefined') {
  module.exports = {
    EPS_SPEED,
    MIN_VALID_SPEED_MPS,
    MIN_RPM_RUNNING,
    MAX_CONSUMPTION,
    MAX_EFFICIENCY,
    calculateFuelFlow,
    calculateInstantConsumption,
    normalizeRpm,
    smoothFuelFlow,
    trimQueue,
    calculateMedian,
    calculateAverage,
    calculateAverageConsumption,
    calculateRange,
    resolveAverageConsumption,
    buildQueueGraphPoints,
    resolveSpeed,
    isEngineRunning,
    getUnitLabels,
    formatDistance,
    formatVolume,
    formatConsumptionRate,
    formatEfficiency,
    formatFlow,
    convertVolumeToUnit,
    convertDistanceToUnit,
    convertVolumePerDistance,
    calculateCO2Factor,
    calculateCO2gPerKm,
    calculateNOxFactor,
    formatCO2,
    classifyCO2,
    meetsEuCo2Limit,
    resolveUnitModeForFuelType,
    resolveFuelType,
    formatFuelTypeLabel,
    simulateFood,
    resetFoodSimulation,
    FOOD_CAPACITY_KCAL,
    FOOD_REST_KCAL_PER_H,
    shouldResetOnFoot,
    updateFoodHistories
  };
}

function loadFuelPriceConfig(callback) {
  var defaults = {
    prices: { Gasoline: 0, Electricity: 0 },
    currency: 'money'
  };

  if (typeof require === 'function' && typeof process !== 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const cfg = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'fuelPrice.json'), 'utf8')
      );
      defaults = cfg;

      const baseDir =
        process.env.KRTEKTM_BNG_USER_DIR ||
        path.join(
          process.platform === 'win32'
            ? process.env.LOCALAPPDATA || ''
            : path.join(process.env.HOME || '', '.local', 'share'),
          'BeamNG.drive'
        );

      const versions = fs
        .readdirSync(baseDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const latest = versions[versions.length - 1];
      if (!latest) {
        if (typeof callback === 'function') callback(defaults);
        return defaults;
      }
      const settingsDir = path.join(
        baseDir,
        latest,
        'settings',
        'krtektm_fuelEconomy'
      );
      fs.mkdirSync(settingsDir, { recursive: true });
      const userFile = path.join(settingsDir, 'fuelPrice.json');
      loadFuelPriceConfig.userFile = userFile;
      if (!fs.existsSync(userFile)) {
        fs.copyFileSync(path.join(__dirname, 'fuelPrice.json'), userFile);
        if (typeof callback === 'function') callback(defaults);
        return defaults;
      }
      const data = JSON.parse(fs.readFileSync(userFile, 'utf8'));
      var prices = {};
      if (data.prices && typeof data.prices === 'object') {
        Object.keys(data.prices).forEach(k => {
          prices[k] = parseFloat(data.prices[k]) || 0;
        });
      } else {
        if (typeof data.liquidFuelPrice !== 'undefined') prices.Gasoline = parseFloat(data.liquidFuelPrice) || 0;
        if (typeof data.electricityPrice !== 'undefined') prices.Electricity = parseFloat(data.electricityPrice) || 0;
      }
      if (prices.Gasoline === undefined) prices.Gasoline = 0;
      if (prices.Electricity === undefined) prices.Electricity = 0;
      const cfgObj = {
        prices,
        currency: data.currency || 'money'
      };
      fs.writeFileSync(userFile, JSON.stringify(cfgObj));
      if (typeof callback === 'function') callback(cfgObj);
      return cfgObj;
    } catch (e) {
      if (typeof callback === 'function') callback(defaults);
      return defaults;
    }
  }

  if (typeof bngApi !== 'undefined' && typeof bngApi.engineLua === 'function') {
    try {
      const lua = [
        '(function()',
        "local user=(core_paths and core_paths.getUserPath and core_paths.getUserPath()) or ''",
        "local dir=user..'settings/krtektm_fuelEconomy/'",
        'FS:directoryCreate(dir)',
        "local p=dir..'fuelPrice.json'",
        'local cfg=jsonReadFile(p)',
        "if not cfg then cfg={prices={Gasoline=0,Electricity=0},currency='money'} jsonWriteFile(p,cfg) end",
        "if not cfg.prices then cfg.prices={Gasoline=0,Electricity=0} end",
        "if cfg.liquidFuelPrice then cfg.prices.Gasoline=cfg.liquidFuelPrice cfg.liquidFuelPrice=nil end",
        "if cfg.electricityPrice then cfg.prices.Electricity=cfg.electricityPrice cfg.electricityPrice=nil end",
        "if cfg.prices.Gasoline==nil then cfg.prices.Gasoline=0 end",
        "if cfg.prices.Electricity==nil then cfg.prices.Electricity=0 end",
        'jsonWriteFile(p,cfg)',
        "return jsonEncode({prices=cfg.prices,currency=cfg.currency or 'money'})",
        'end)()'
      ].join('\n');
      bngApi.engineLua(lua, function (res) {
        var cfg = defaults;
        try { cfg = JSON.parse(res); } catch (e) { /* ignore */ }
        if (typeof callback === 'function') callback(cfg);
      });
    } catch (e) {
      if (typeof callback === 'function') callback(defaults);
    }
    return defaults;
  }

  if (typeof callback === 'function') callback(defaults);
  return defaults;
}

angular.module('beamng.apps')
.directive('okFuelEconomy', [function () {
  return {
    templateUrl: '/ui/modules/apps/okFuelEconomy/app.html',
    replace: true,
    restrict: 'EA',
    scope: true,
    controller: ['$log', '$scope', '$timeout', function ($log, $scope, $timeout) {
      if (typeof $timeout !== 'function') $timeout = function (fn) { fn(); };
      var streamsList = ['electrics', 'engineInfo', 'okGameState'];
      StreamsManager.add(streamsList);
      if (bngApi && typeof bngApi.engineLua === 'function') {
        bngApi.engineLua('extensions.load("okGameState")');
      }

      $scope.gamePaused = false;

      function pollGamePaused() {
        if (!bngApi || typeof bngApi.engineLua !== 'function') return;
        bngApi.engineLua(
          'extensions.okGameState and extensions.okGameState.getState and extensions.okGameState.getState().paused',
          function (res) {
            var paused =
              res === true || res === 1 || res === '1' || res === 'true';
            if (typeof $scope.$evalAsync === 'function') {
              $scope.$evalAsync(function () {
                $scope.gamePaused = paused;
                if (paused) {
                  lastTime_ms = performance.now();
                }
              });
            } else {
              $scope.gamePaused = paused;
              if (paused) {
                lastTime_ms = performance.now();
              }
            }
          }
        );
      }
      var pauseTimer = setInterval(pollGamePaused, 250);
      if (pauseTimer.unref) pauseTimer.unref();
      $scope.$on('$destroy', function () {
        clearInterval(pauseTimer);
      });

        $scope.fuelPrices = { Gasoline: 0, Electricity: 0 };
        $scope.liquidFuelPriceValue = 0;
        $scope.electricityPriceValue = 0;
        $scope.currency = 'money';

        function updateCostPrice(unitLabels, priceForMode) {
          var mode = getActiveUnitMode() || 'metric';
          if (!unitLabels) {
            unitLabels = getUnitLabels(mode);
          }
          if (!$scope.fuelType || $scope.fuelType === 'None') {
            priceForMode = 0;
          } else if (typeof priceForMode !== 'number') {
            priceForMode =
              mode === 'electric'
                ? $scope.electricityPriceValue
                : $scope.liquidFuelPriceValue;
          }
          $scope.costPrice =
            priceForMode.toFixed(2) +
            ' ' +
            $scope.currency +
            '/' +
            unitLabels.volume;
        }

        loadFuelPriceConfig(function (cfg) {
          var applyInit = function () {
            $scope.fuelPrices = cfg.prices || { Gasoline: 0, Electricity: 0 };
            $scope.liquidFuelPriceValue = $scope.fuelPrices.Gasoline || 0;
            $scope.electricityPriceValue = $scope.fuelPrices.Electricity || 0;
            $scope.currency = cfg.currency;
            updateCostPrice();
            setTimeout(refreshCostOutputs, 0);
            fetchFuelType();
          };
          if (typeof $scope.$evalAsync === 'function') $scope.$evalAsync(applyInit); else applyInit();
        });

      var pollMs = 1000;
      if (typeof process !== 'undefined' && process.env && process.env.KRTEKTM_FUEL_POLL_MS) {
        var intVal = parseInt(process.env.KRTEKTM_FUEL_POLL_MS, 10);
        if (intVal > 0) pollMs = intVal;
      }
        var priceTimer = setInterval(function () {
          loadFuelPriceConfig(function (cfg) {
            var pricesChanged = JSON.stringify(cfg.prices || {}) !== JSON.stringify($scope.fuelPrices);
            if (
              pricesChanged ||
              cfg.currency !== $scope.currency
            ) {
              var apply = function () {
                $scope.fuelPrices = cfg.prices || {};
                if ($scope.fuelType === 'None') {
                  $scope.liquidFuelPriceValue = 0;
                  $scope.electricityPriceValue = 0;
                } else {
                  var ftPrice = $scope.fuelPrices[$scope.fuelType];
                  $scope.liquidFuelPriceValue =
                    typeof ftPrice === 'number'
                      ? ftPrice
                      : $scope.fuelPrices.Gasoline || 0;
                  $scope.electricityPriceValue = $scope.fuelPrices.Electricity || 0;
                }
                $scope.currency = cfg.currency;
                updateCostPrice();
                refreshCostOutputs();
              };
              if (typeof $scope.$evalAsync === 'function') $scope.$evalAsync(apply); else apply();
            }
          });
        }, pollMs);
      if (priceTimer.unref) priceTimer.unref();

      $scope.$on('$destroy', function () {
        StreamsManager.remove(streamsList);
        clearInterval(priceTimer);
      });

      // Settings for visible fields
      var SETTINGS_KEY = 'okFuelEconomyVisible';
      var UNIT_MODE_KEY = 'okFuelEconomyUnitMode';
      var STYLE_KEY = 'okFuelEconomyUseCustomStyles';
      var PREFERRED_UNIT_KEY = 'okFuelEconomyPreferredUnit';
      var ROW_ORDER_KEY = 'okFeRowOrder';
      $scope.useCustomStyles = localStorage.getItem(STYLE_KEY) !== 'false';
      $scope.toggleCustomStyles = function () {
        $scope.useCustomStyles = !$scope.useCustomStyles;
        try { localStorage.setItem(STYLE_KEY, $scope.useCustomStyles ? "true" : "false"); } catch (e) {}
      };
      $scope.settingsOpen = false;
      $scope.openFuelPriceEditor = function ($event) {
        $event.preventDefault();
        var liquid = preferredLiquidUnit === 'imperial' ? 'gal' : 'L';
        fuelPriceEditorLoaded = true;
        bngApi.engineLua(
          'extensions.load("fuelPriceEditor") extensions.fuelPriceEditor.setLiquidUnit("' + liquid + '")'
        );
      };
      $scope.unitModeLabels = {
        metric: 'Metric (L, km)',
        imperial: 'Imperial (gal, mi)',
        electric: 'Electric (kWh, km)',
        food: 'Food (kcal, km)'
      };
      $scope.unitModeOptions = {
        metric: $scope.unitModeLabels.metric,
        imperial: $scope.unitModeLabels.imperial,
        electric: $scope.unitModeLabels.electric
      };
        $scope.unitMenuOpen = false;
        $scope.unitMode = localStorage.getItem(UNIT_MODE_KEY) || 'metric';
        var preferredLiquidUnit =
          localStorage.getItem(PREFERRED_UNIT_KEY) ||
          ($scope.unitMode === 'imperial' ? 'imperial' : 'metric');
        var fuelPriceEditorLoaded = false;
        var manualUnit = false;
        var lastFuelType = '';

        function getActiveUnitMode() {
          return resolveUnitModeForFuelType(lastFuelType, $scope.unitMode);
        }
        $scope.setUnit = function (mode) {
          $scope.unitMode = mode;
          if (mode !== 'electric') {
            preferredLiquidUnit = mode;
            try { localStorage.setItem(PREFERRED_UNIT_KEY, preferredLiquidUnit); } catch (e) {}
            if (fuelPriceEditorLoaded) {
              var liquid = preferredLiquidUnit === 'imperial' ? 'gal' : 'L';
              bngApi.engineLua(
                'extensions.fuelPriceEditor.setLiquidUnit("' + liquid + '")'
              );
            }
          }
          manualUnit = true;
          updateUnitLabels();
          updateCostPrice();
          refreshCostOutputs();
          $scope.unitMenuOpen = false;
        };
        function updateUnitLabels() {
          var lbls = getUnitLabels($scope.unitMode);
          $scope.unitConsumptionUnit = lbls.consumption;
          $scope.unitEfficiencyUnit = lbls.efficiency;
          $scope.unitFlowUnit = lbls.flow;
          $scope.unitDistanceUnit = lbls.distance;
        }
        updateUnitLabels();
        updateCostPrice();

        function applyAutoUnitMode(type) {
          var desired = resolveUnitModeForFuelType(type, preferredLiquidUnit);
          if (desired === 'food') {
            if ($scope.unitMode !== 'food') {
              $scope.unitMode = 'food';
              updateUnitLabels();
              updateCostPrice();
              refreshCostOutputs();
            }
            return;
          }
          if (!manualUnit && desired !== $scope.unitMode) {
            $scope.unitMode = desired;
            updateUnitLabels();
            updateCostPrice();
            refreshCostOutputs();
          }
        }

        function fetchFuelType() {
          if (
            typeof window === 'undefined' ||
            typeof bngApi === 'undefined' ||
            typeof bngApi.activeObjectLua !== 'function'
          )
            return;
          var lua = [
            '(function()',
            'local stor=energyStorage.getStorages and energyStorage.getStorages()',
            'local t=""',
            'local hasEnergy=false',
            'if stor then',
            '  for _,s in pairs(stor) do',
            '    hasEnergy=true',
            '    if s.energyType and s.energyType:lower()~="air" then t=s.energyType break end',
            '  end',
            '  if t=="" then for _,s in pairs(stor) do if s.energyType then t=s.energyType break end end end',
            'end',
            'local hasTire=false',
            'if wheels and wheels.wheels then',
            '  for _,w in pairs(wheels.wheels) do if w.hasTire then hasTire=true break end end',
            'end',
            'if not hasEnergy and not hasTire then t="Food" end',
            'return jsonEncode({t=t})',
            'end)()'
          ].join('\n');
          bngApi.activeObjectLua(lua, function (res) {
            var parsed = {};
            try { parsed = JSON.parse(res); } catch (e) {}
            $scope.$evalAsync(function () {
              var prevType = lastFuelType;
              lastFuelType = resolveFuelType(lastFuelType, parsed.t);
              $scope.fuelType = formatFuelTypeLabel(lastFuelType);
              if ($scope.fuelType !== 'None' && $scope.fuelPrices[$scope.fuelType] == null) {
                $scope.fuelPrices[$scope.fuelType] = 0;
                if (typeof require === 'function' && loadFuelPriceConfig.userFile) {
                  try {
                    const fs = require('fs');
                    const data = { prices: $scope.fuelPrices, currency: $scope.currency };
                    fs.writeFileSync(loadFuelPriceConfig.userFile, JSON.stringify(data));
                  } catch (e) {}
                } else if (typeof bngApi !== 'undefined' && typeof bngApi.engineLua === 'function') {
                  var cmd = 'extensions.load("fuelPriceEditor")';
                  bngApi.engineLua(cmd, function () {
                    bngApi.engineLua('extensions.fuelPriceEditor.ensureFuelType(' + JSON.stringify($scope.fuelType) + ')');
                  });
                }
              }
              if ($scope.fuelType !== 'None') {
                $scope.liquidFuelPriceValue = $scope.fuelPrices[$scope.fuelType] || 0;
                $scope.electricityPriceValue = $scope.fuelPrices.Electricity || 0;
              } else {
                $scope.liquidFuelPriceValue = 0;
                $scope.electricityPriceValue = 0;
              }
              applyAutoUnitMode(lastFuelType);
              if (lastFuelType && lastFuelType.toLowerCase() === 'food') {
                updateCostPrice();
                if (shouldResetOnFoot(prevType, lastFuelType)) {
                  resetOnFootOutputs();
                }
              } else {
                updateCostPrice();
                if (prevType !== lastFuelType) {
                  var mode = getActiveUnitMode();
                  resetVehicleOutputs(mode);
                }
                refreshCostOutputs();
              }
            });
          });
        }
      $scope.visible = {
        heading: true,
        distanceMeasured: true,
        distanceEcu: true,
        fuelUsed: true,
        fuelLeft: true,
        fuelCap: true,
        fuelType: true,
        costPrice: false,
        totalCost: false,
        instantLph: true,
        instantL100km: true,
        instantKmL: true,
        instantGraph: true,
        instantKmLGraph: true,
        instantCO2: true,
        avgL100km: true,
        avgKmL: true,
        avgGraph: true,
        avgKmLGraph: true,
        avgCost: false,
        avgCO2: true,
        range: true,
        tripDistance: true,
        tripFuelUsed: false,
        tripTotalCost: false,
        tripTotalCO2: false,
        tripTotalNOx: false,
        tripAvgL100km: true,
        tripAvgKmL: true,
        tripGraph: true,
        tripKmLGraph: true,
        tripRange: true,
        tripAvgCost: false,
        tripAvgCO2: true,
        tripReset: true,
        webEndpoint: false
      };
      try {
        var s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (s && typeof s === 'object') {
          // backward compatibility for old "instant" flag
          if ('instant' in s && !('instantLph' in s) && !('instantL100km' in s) && !('instantKmL' in s)) {
            s.instantLph = s.instantL100km = s.instantKmL = s.instant;
            delete s.instant;
          }
          // backward compatibility for old avg flag
          if ('avg' in s && !('avgL100km' in s) && !('avgKmL' in s)) {
            s.avgL100km = s.avgKmL = s.avg;
            delete s.avg;
          }
          // backward compatibility for old tripAvg flag
          if ('tripAvg' in s && !('tripAvgL100km' in s) && !('tripAvgKmL' in s)) {
            s.tripAvgL100km = s.tripAvgKmL = s.tripAvg;
            delete s.tripAvg;
          }
          if ('avgCostTotal' in s) { delete s.avgCostTotal; }
          if ('avgCostPerDistance' in s) { s.avgCost = s.avgCostPerDistance; delete s.avgCostPerDistance; }
          if ('tripAvgCostTotal' in s) { s.tripTotalCost = s.tripAvgCostTotal; delete s.tripAvgCostTotal; }
          if ('tripAvgCostPerDistance' in s) { s.tripAvgCost = s.tripAvgCostPerDistance; delete s.tripAvgCostPerDistance; }
          if ('costTotal' in s) { s.totalCost = s.costTotal; delete s.costTotal; }
          if ('costPerDistance' in s) { s.avgCost = s.costPerDistance; delete s.costPerDistance; }
          if ('tripCostTotal' in s) { s.tripTotalCost = s.tripCostTotal; delete s.tripCostTotal; }
          if ('tripCostPerDistance' in s) { s.tripAvgCost = s.tripCostPerDistance; delete s.tripCostPerDistance; }
          Object.assign($scope.visible, s);
        }
      } catch (e) { /* ignore */ }

      var webEndpointRunning = false;
      if ($scope.visible.webEndpoint && bngApi && typeof bngApi.engineLua === 'function') {
        bngApi.engineLua('extensions.load("okWebServer")');
        bngApi.engineLua('extensions.okWebServer.start()');
        webEndpointRunning = true;
      }

      $scope.saveSettings = function () {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify($scope.visible));
          localStorage.setItem(UNIT_MODE_KEY, $scope.unitMode);
          if ($scope.unitMode !== 'electric') {
            localStorage.setItem(PREFERRED_UNIT_KEY, $scope.unitMode);
          }
        } catch (e) { /* ignore */ }

        if ($scope.visible.webEndpoint && !webEndpointRunning) {
          if (bngApi && typeof bngApi.engineLua === 'function') {
            bngApi.engineLua('extensions.load("okWebServer")');
            bngApi.engineLua('extensions.okWebServer.start()');
          }
          webEndpointRunning = true;
        } else if (!$scope.visible.webEndpoint && webEndpointRunning) {
          if (bngApi && typeof bngApi.engineLua === 'function') {
            bngApi.engineLua('extensions.okWebServer.stop()');
          }
          webEndpointRunning = false;
        }
        $scope.settingsOpen = false;
      };

      function saveRowOrder() {
        var tbody = document.getElementById('dataRows');
        if (!tbody) return;
        var order = Array.prototype.map.call(tbody.children, function (r) { return r.id; });
        try { localStorage.setItem(ROW_ORDER_KEY, JSON.stringify(order)); } catch (e) {}
      }

      $scope.moveRow = function ($event, dir) {
        var item = $event.target.closest('.setting-item');
        if (!item) return;
        var rowId = item.getAttribute('data-row');
        var tbody = document.getElementById('dataRows');
        var settingsList = document.getElementById('settingsList');
        var row = document.getElementById(rowId);
        if (!row || !tbody || !settingsList) return;
        if (dir < 0) {
          var prevRow = row.previousElementSibling;
          var prevItem = item.previousElementSibling;
          if (prevRow && prevItem) {
            tbody.insertBefore(row, prevRow);
            settingsList.insertBefore(item, prevItem);
          }
        } else {
          var nextRow = row.nextElementSibling;
          var nextItem = item.nextElementSibling;
          if (nextRow && nextItem) {
            tbody.insertBefore(nextRow, row);
            settingsList.insertBefore(nextItem, item);
          }
        }
        saveRowOrder();
      };

        function loadRowOrder() {
          if (typeof document === 'undefined') return;
          var order;
          try { order = JSON.parse(localStorage.getItem(ROW_ORDER_KEY)); } catch (e) { order = null; }
          if (!Array.isArray(order)) return;
          var tbody = document.getElementById('dataRows');
          var settingsList = document.getElementById('settingsList');
          if (!tbody || !settingsList) return;
          var rows = {};
          Array.prototype.forEach.call(tbody.children, function (r) { rows[r.id] = r; });
          var settings = {};
          Array.prototype.forEach.call(settingsList.children, function (s) { settings[s.getAttribute('data-row')] = s; });
          order.forEach(function (id) {
            if (rows[id]) tbody.appendChild(rows[id]);
            if (settings[id]) settingsList.appendChild(settings[id]);
          });
        }

        $timeout(loadRowOrder, 0);

      // UI outputs
      $scope.data1 = ''; // distance measured
      $scope.data6 = ''; // distance from ECU
      $scope.fuelUsed = '';
      $scope.fuelLeft = '';
      $scope.fuelCap = '';
      $scope.avgL100km = ''; // avg consumption L/100km
      $scope.avgKmL = ''; // avg consumption km/L
      $scope.data4 = ''; // range
      $scope.instantLph = '';
      $scope.instantL100km = '';
      $scope.instantKmL = '';
      $scope.tripAvgL100km = ''; // overall average L/100km
      $scope.tripAvgKmL = ''; // overall average km/L
      $scope.tripAvgCO2 = '';
      $scope.tripCo2Class = '';
      $scope.tripAvgHistory = '';
      $scope.tripAvgKmLHistory = '';
      $scope.avgHistory = '';
      $scope.avgKmLHistory = '';
      $scope.instantHistory = '';
      $scope.instantKmLHistory = '';
      $scope.costPrice = '';
      $scope.avgCost = '';
      $scope.totalCost = '';
      $scope.tripAvgCostLiquid = '';
      $scope.tripAvgCostElectric = '';
      $scope.tripTotalCostLiquid = '';
      $scope.tripTotalCostElectric = '';
      $scope.tripFuelUsedLiquid = '';
      $scope.tripFuelUsedElectric = '';
      $scope.tripTotalCO2 = '';
      $scope.tripTotalNOx = '';

      var distance_m = 0;
      var lastDistance_m = 0;
      var lastTime_ms = performance.now();
      var startFuel_l = null;
      var previousFuel_l = null;
      var tripFuelUsedLiquid_l = 0;
      var tripFuelUsedElectric_l = 0;
      var tripCostLiquid = 0;
      var tripCostElectric = 0;
      var tripDistanceLiquid_m = 0;
      var tripDistanceElectric_m = 0;
      var tripCo2_g = 0;
      var tripNox_g = 0;
      var lastFuelFlow_lps = 0; // last smoothed value
      var idleFuelFlow_lps = 0;
      var idleRpm = 0;
      var foodFuel_kcal = FOOD_CAPACITY_KCAL;
        var lastThrottle = 0;
        var engineWasRunning = false;
        var initialized = false;

        var lastCapacity_l = null;
      var lastInstantUpdate_ms = 0;
      var INSTANT_UPDATE_INTERVAL = 250;

      $scope.vehicleNameStr = "";

      // --------- Overall persistence (NEW) ----------
      var OVERALL_KEY = 'okFuelEconomyOverall';
      var TRIP_KEY = 'okFuelEconomyTripTotals';
      var MAX_ENTRIES = 20000; // pevný počet hodnot pro frontu

      var overall = {
          queue: [],
          co2Queue: [],
          distance: 0,
          fuelUsedLiquid: 0,
          fuelUsedElectric: 0,
          tripCostLiquid: 0,
          tripCostElectric: 0,
          tripDistanceLiquid: 0,
          tripDistanceElectric: 0,
          tripCo2: 0,
          tripNox: 0
      }; // fronta posledních průměrů + celková ujetá vzdálenost a spotřebované palivo
      try {
          var saved = JSON.parse(localStorage.getItem(OVERALL_KEY));
          if (saved && Array.isArray(saved.queue)) {
              overall = saved;
              if (!Array.isArray(overall.co2Queue)) overall.co2Queue = [];
              if (!Number.isFinite(overall.fuelUsedLiquid)) {
                  overall.fuelUsedLiquid = Number.isFinite(overall.fuelUsed) ? overall.fuelUsed : 0;
              }
              if (!Number.isFinite(overall.fuelUsedElectric)) overall.fuelUsedElectric = 0;
              if (!Number.isFinite(overall.tripCostLiquid)) overall.tripCostLiquid = 0;
              if (!Number.isFinite(overall.tripCostElectric)) overall.tripCostElectric = 0;
              if (!Number.isFinite(overall.tripDistanceLiquid)) overall.tripDistanceLiquid = 0;
              if (!Number.isFinite(overall.tripDistanceElectric)) overall.tripDistanceElectric = 0;
              if (!Number.isFinite(overall.tripCo2)) overall.tripCo2 = 0;
              if (!Number.isFinite(overall.tripNox)) overall.tripNox = 0;
          }
      } catch (e) { /* ignore */ }

      // Separate trip totals persistence to avoid accidental resets
      var tripTotals = {
          fuelUsedLiquid: overall.fuelUsedLiquid || 0,
          fuelUsedElectric: overall.fuelUsedElectric || 0,
          costLiquid: overall.tripCostLiquid || 0,
          costElectric: overall.tripCostElectric || 0,
          co2: overall.tripCo2 || 0,
          nox: overall.tripNox || 0
      };
      try {
          var savedTrip = JSON.parse(localStorage.getItem(TRIP_KEY));
          if (savedTrip) {
              if (Number.isFinite(savedTrip.fuelUsedLiquid)) tripTotals.fuelUsedLiquid = savedTrip.fuelUsedLiquid;
              if (Number.isFinite(savedTrip.fuelUsedElectric)) tripTotals.fuelUsedElectric = savedTrip.fuelUsedElectric;
              if (Number.isFinite(savedTrip.costLiquid)) tripTotals.costLiquid = savedTrip.costLiquid;
              if (Number.isFinite(savedTrip.costElectric)) tripTotals.costElectric = savedTrip.costElectric;
              if (Number.isFinite(savedTrip.co2)) tripTotals.co2 = savedTrip.co2;
              if (Number.isFinite(savedTrip.nox)) tripTotals.nox = savedTrip.nox;
          }
      } catch (e) { /* ignore */ }

      tripFuelUsedLiquid_l = tripTotals.fuelUsedLiquid;
      tripFuelUsedElectric_l = tripTotals.fuelUsedElectric;
      tripCostLiquid = tripTotals.costLiquid;
      tripCostElectric = tripTotals.costElectric;
      tripCo2_g = tripTotals.co2;
      tripNox_g = tripTotals.nox;
      tripDistanceLiquid_m = overall.tripDistanceLiquid || 0;
      tripDistanceElectric_m = overall.tripDistanceElectric || 0;

      overall.fuelUsedLiquid = tripFuelUsedLiquid_l;
      overall.fuelUsedElectric = tripFuelUsedElectric_l;
      overall.tripCostLiquid = tripCostLiquid;
      overall.tripCostElectric = tripCostElectric;
      overall.tripCo2 = tripCo2_g;
      overall.tripNox = tripNox_g;

      // initialise scope with persisted trip values so they survive game restarts
      var initLiquidUnitMode = $scope.unitMode === 'imperial' ? 'imperial' : 'metric';
      $scope.tripFuelUsedLiquid = tripFuelUsedLiquid_l > 0
        ? formatVolume(tripFuelUsedLiquid_l, initLiquidUnitMode, 2)
        : '';
      $scope.tripFuelUsedElectric = tripFuelUsedElectric_l > 0
        ? formatVolume(tripFuelUsedElectric_l, 'electric', 2)
        : '';
      $scope.tripTotalCostLiquid = tripCostLiquid > 0
        ? tripCostLiquid.toFixed(2) + ' ' + $scope.currency
        : '';
      $scope.tripTotalCostElectric = tripCostElectric > 0
        ? tripCostElectric.toFixed(2) + ' ' + $scope.currency
        : '';
      $scope.tripTotalCO2 = tripCo2_g > 0 ? formatMass(tripCo2_g) : '';
      $scope.tripTotalNOx = tripNox_g > 0 ? formatMass(tripNox_g) : '';
      var initTripAvgCo2 = calculateMedian(overall.co2Queue);
      $scope.tripAvgCO2 = formatCO2(initTripAvgCo2, 0, $scope.unitMode);
      $scope.tripCo2Class = classifyCO2(initTripAvgCo2);

      function saveTripTotals() {
          tripTotals.fuelUsedLiquid = tripFuelUsedLiquid_l;
          tripTotals.fuelUsedElectric = tripFuelUsedElectric_l;
          tripTotals.costLiquid = tripCostLiquid;
          tripTotals.costElectric = tripCostElectric;
          tripTotals.co2 = tripCo2_g;
          tripTotals.nox = tripNox_g;
          try { localStorage.setItem(TRIP_KEY, JSON.stringify(tripTotals)); } catch (e) { /* ignore */ }
      }

        function saveOverall() {
            saveTripTotals();
            try { localStorage.setItem(OVERALL_KEY, JSON.stringify(overall)); } catch (e) { /* ignore */ }
        }

        function refreshCostOutputs() {
          var mode = getActiveUnitMode();
          var unitLabels = getUnitLabels(mode);
          var priceForMode =
            mode === 'electric'
              ? $scope.electricityPriceValue
              : $scope.liquidFuelPriceValue;
          updateCostPrice(unitLabels, priceForMode);
          if (mode === 'food') return;
          var fuelUsed_l = 0;
          if (startFuel_l !== null && previousFuel_l !== null) {
            fuelUsed_l = startFuel_l - previousFuel_l;
            if (fuelUsed_l < 0) fuelUsed_l = 0;
          }
          var fuelUsedUnit = convertVolumeToUnit(fuelUsed_l, mode);
          var totalCostVal = fuelUsedUnit * priceForMode;
          $scope.totalCost = totalCostVal.toFixed(2) + ' ' + $scope.currency;
          var avgLitersPerKm = (overall.previousAvgTrip || overall.previousAvg || 0) / 100;
          var avgVolPerDistUnit = convertVolumePerDistance(avgLitersPerKm, mode);
          var avgCostVal = avgVolPerDistUnit * priceForMode;
          $scope.avgCost =
            avgCostVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance;
          var overall_median = calculateMedian(overall.queue);
          var medianLitersPerKm = overall_median / 100;
          var medianVolPerDistUnit = convertVolumePerDistance(medianLitersPerKm, mode);
          var tripAvgCostLiquidVal = medianVolPerDistUnit * $scope.liquidFuelPriceValue;
          var tripAvgCostElectricVal = medianVolPerDistUnit * $scope.electricityPriceValue;
          $scope.tripAvgCostLiquid =
            tripAvgCostLiquidVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance;
          $scope.tripAvgCostElectric =
            tripAvgCostElectricVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance;
          $scope.tripTotalCostLiquid =
            tripCostLiquid.toFixed(2) + ' ' + $scope.currency;
          $scope.tripTotalCostElectric =
            tripCostElectric.toFixed(2) + ' ' + $scope.currency;
        }
        if (typeof module !== 'undefined') {
          module.exports.refreshCostOutputs = refreshCostOutputs;
        }

      // --------- Average history persistence (NEW) ----------
  var AVG_KEY = 'okFuelEconomyAvgHistory';
  var AVG_MAX_ENTRIES = 1000;

  var avgHistory = { queue: [] };
  try {
      var savedAvg = JSON.parse(localStorage.getItem(AVG_KEY));
      if (savedAvg && Array.isArray(savedAvg.queue)) {
          avgHistory = savedAvg;
      }
  } catch (e) { /* ignore */ }

  var speedAvg = { queue: [] };
  var avgRecent = { queue: [] };

      function saveAvgHistory() {
          try { localStorage.setItem(AVG_KEY, JSON.stringify(avgHistory)); } catch (e) { /* ignore */ }
      }

      // --------- Instant history persistence (NEW) ----------
      var INST_KEY = 'okFuelEconomyInstantHistory';
      var INST_EFF_KEY = 'okFuelEconomyInstantEffHistory';
      var INSTANT_MAX_ENTRIES = 1000;

      var instantHistory = { queue: [] };
      try {
          var savedInst = JSON.parse(localStorage.getItem(INST_KEY));
          if (savedInst && Array.isArray(savedInst.queue)) {
              instantHistory = savedInst;
          }
      } catch (e) { /* ignore */ }

      var instantEffHistory = { queue: [] };
      try {
          var savedInstEff = JSON.parse(localStorage.getItem(INST_EFF_KEY));
          if (savedInstEff && Array.isArray(savedInstEff.queue)) {
              instantEffHistory = savedInstEff;
          }
      } catch (e) { /* ignore */ }

      function saveInstantHistory() {
          try { localStorage.setItem(INST_KEY, JSON.stringify(instantHistory)); } catch (e) { /* ignore */ }
      }

      function saveInstantEffHistory() {
          try { localStorage.setItem(INST_EFF_KEY, JSON.stringify(instantEffHistory)); } catch (e) { /* ignore */ }
      }

      function resetInstantHistory() {
          instantHistory = { queue: [] };
          instantEffHistory = { queue: [] };
          saveInstantHistory();
          saveInstantEffHistory();
          $scope.instantHistory = '';
          $scope.instantKmLHistory = '';
      }

      function resetAvgHistory() {
          avgHistory = { queue: [] };
          saveAvgHistory();
          $scope.avgHistory = '';
          $scope.avgKmLHistory = '';
          speedAvg = { queue: [] };
          avgRecent = { queue: [] };
      }

      function hardReset(preserveTripFuel) {
        distance_m = 0;
        lastDistance_m = 0;
        startFuel_l = null;
        previousFuel_l = null;
        lastCapacity_l = null;
        lastFuelFlow_lps = 0;
        idleFuelFlow_lps = 0;
        idleRpm = 0;
        lastThrottle = 0;
        if (!preserveTripFuel) {
          tripFuelUsedLiquid_l = 0;
          tripFuelUsedElectric_l = 0;
          tripCostLiquid = 0;
          tripCostElectric = 0;
          tripDistanceLiquid_m = 0;
          tripDistanceElectric_m = 0;
          overall.fuelUsedLiquid = 0;
          overall.fuelUsedElectric = 0;
          overall.tripCostLiquid = 0;
          overall.tripCostElectric = 0;
          overall.tripDistanceLiquid = 0;
          overall.tripDistanceElectric = 0;
          saveOverall();
          $scope.tripFuelUsedLiquid = '';
          $scope.tripFuelUsedElectric = '';
          $scope.tripTotalCostLiquid = '';
          $scope.tripTotalCostElectric = '';
        }
        lastTime_ms = performance.now();
        $scope.vehicleNameStr = "";
        engineWasRunning = false;
        speedAvg = { queue: [] };
        resetInstantHistory();
        resetAvgHistory();
      }

      function resetOnFootOutputs() {
        hardReset(true);
        resetFoodSimulation();
        foodFuel_kcal = FOOD_CAPACITY_KCAL;
        var mode = 'food';
        var labels = getUnitLabels(mode);
        $scope.data1 = formatDistance(0, mode, 1);
        $scope.data6 = formatDistance(0, mode, 1);
        $scope.fuelUsed = formatVolume(0, mode, 2);
        $scope.fuelLeft = formatVolume(0, mode, 2);
        $scope.fuelCap = formatVolume(0, mode, 1);
        $scope.avgL100km = formatConsumptionRate(0, mode, 1);
        $scope.avgKmL = formatEfficiency(0, mode, 2);
        $scope.avgCO2 = formatCO2(0, 0, mode);
        $scope.avgCo2Class = classifyCO2(0);
        $scope.avgCo2Compliant = false;
        $scope.data4 = formatDistance(0, mode, 0);
        $scope.instantLph = formatFlow(0, mode, 1);
        $scope.instantL100km = formatConsumptionRate(0, mode, 1);
        $scope.instantKmL = formatEfficiency(0, mode, 2);
        $scope.instantCO2 = formatCO2(0, 0, mode);
        $scope.co2Class = classifyCO2(0);
        $scope.totalCost = '0.00 ' + $scope.currency;
        $scope.avgCost =
          '0.00 ' + $scope.currency + '/' + labels.distance;
      }

      function resetVehicleOutputs(mode) {
        hardReset(true);
        var labels = getUnitLabels(mode);
        $scope.fuelUsed = formatVolume(0, mode, 2);
        $scope.fuelLeft = formatVolume(0, mode, 2);
        $scope.fuelCap = formatVolume(0, mode, 1);
        $scope.avgL100km = formatConsumptionRate(0, mode, 1);
        $scope.avgKmL = formatEfficiency(0, mode, 2);
        $scope.avgCO2 = formatCO2(0, 0, mode);
        $scope.avgCo2Class = classifyCO2(0);
        $scope.avgCo2Compliant = false;
        $scope.data4 = formatDistance(0, mode, 0);
        $scope.instantLph = formatFlow(0, mode, 1);
        $scope.instantL100km = formatConsumptionRate(0, mode, 1);
        $scope.instantKmL = formatEfficiency(0, mode, 2);
        $scope.instantCO2 = formatCO2(0, 0, mode);
        $scope.co2Class = classifyCO2(0);
        $scope.totalCost = '0.00 ' + $scope.currency;
        $scope.avgCost =
          '0.00 ' + $scope.currency + '/' + labels.distance;
      }

      $scope.reset = function () {
        $log.debug('<ok-fuel-economy> manual reset');
        hardReset(false);
      };

      // reset overall včetně vzdálenosti
      $scope.resetOverall = function () {
          $log.debug('<ok-fuel-economy> manual reset overall');
          overall = { queue: [], co2Queue: [], distance: 0, fuelUsedLiquid: 0, fuelUsedElectric: 0, tripCostLiquid: 0, tripCostElectric: 0, tripDistanceLiquid: 0, tripDistanceElectric: 0, tripCo2: 0, tripNox: 0 };
          avgHistory = { queue: [] };
          resetInstantHistory();
          tripFuelUsedLiquid_l = 0;
          tripFuelUsedElectric_l = 0;
          tripCostLiquid = 0;
          tripCostElectric = 0;
          tripDistanceLiquid_m = 0;
          tripDistanceElectric_m = 0;
          tripCo2_g = 0;
          tripNox_g = 0;
          tripTotals.co2 = 0;
          tripTotals.nox = 0;
          var resetMode = getActiveUnitMode();
          $scope.tripAvgL100km = formatConsumptionRate(0, resetMode, 1);
          $scope.tripAvgKmL = formatEfficiency(Infinity, resetMode, 2);
          $scope.tripAvgCO2 = formatCO2(0, 0, resetMode);
          $scope.tripCo2Class = classifyCO2(0);
          $scope.tripTotalCO2 = '';
          $scope.tripTotalNOx = '';
          $scope.tripAvgCostLiquid = '';
          $scope.tripAvgCostElectric = '';
          $scope.tripTotalCostLiquid = '';
          $scope.tripTotalCostElectric = '';
          $scope.tripFuelUsedLiquid = '';
          $scope.tripFuelUsedElectric = '';
          $scope.data6 = formatDistance(0, resetMode, 1); // reset trip
          $scope.tripAvgHistory = '';
          $scope.tripAvgKmLHistory = '';
          $scope.avgHistory = '';
          $scope.avgKmLHistory = '';
          saveAvgHistory();
          saveOverall();
      };

      $scope.$on('VehicleFocusChanged', function () {
        $log.debug('<ok-fuel-economy> vehicle changed -> reset trip');
        hardReset(true);
        manualUnit = false;
        lastFuelType = '';
        $scope.fuelType = 'None';
        fetchFuelType();
      });

      $scope.$on('streamsUpdate', function (event, streams) {
        $scope.$evalAsync(function () {
          if (streams.okGameState && typeof streams.okGameState.paused !== 'undefined') {
            $scope.gamePaused = !!streams.okGameState.paused;
          }
          if ($scope.gamePaused) {
            lastTime_ms = performance.now();
            return;
          }
          if ($scope.fuelType === 'Food') {
            fetchFuelType();
            if (!streams.electrics) return;
            var now_ms = performance.now();
            var dt = Math.max(0, (now_ms - lastTime_ms) / 1000);
            lastTime_ms = now_ms;
            var speed_mps = resolveSpeed(
              streams.electrics.wheelspeed,
              streams.electrics.airspeed,
              EPS_SPEED
            );
            var deltaDistance = speed_mps * dt;
            distance_m += deltaDistance;
            // Record resolved speed with timestamp for EU compliance window.
            speedAvg.queue.push({ speed: Math.abs(speed_mps), time: now_ms });
            while (
              speedAvg.queue.length > 0 &&
              now_ms - speedAvg.queue[0].time > EU_SPEED_WINDOW_MS
            ) {
              speedAvg.queue.shift();
            }
            var res = simulateFood(speed_mps, dt, foodFuel_kcal, now_ms / 1000);
            foodFuel_kcal = res.remaining;
            var mode = 'food';
            var labels = getUnitLabels(mode);
            var price = $scope.liquidFuelPriceValue || 0;
            updateCostPrice(labels, price);
            var used_kcal = FOOD_CAPACITY_KCAL - foodFuel_kcal;
            $scope.data1 = formatDistance(distance_m, mode, 1);
            $scope.data6 = formatDistance(streams.electrics.trip || 0, mode, 1);
            $scope.fuelUsed = formatVolume(used_kcal, mode, 2);
            $scope.fuelLeft = formatVolume(foodFuel_kcal, mode, 2);
            $scope.fuelCap = formatVolume(FOOD_CAPACITY_KCAL, mode, 1);
            $scope.instantLph = formatFlow(res.rate, mode, 1);
            $scope.instantL100km = formatConsumptionRate(res.instPer100km, mode, 1);
            $scope.instantKmL = formatEfficiency(res.efficiency, mode, 2);
            $scope.avgL100km = formatConsumptionRate(res.instPer100km, mode, 1);
            $scope.avgKmL = formatEfficiency(res.efficiency, mode, 2);
            $scope.avgCO2 = formatCO2(0, 0, mode);
            $scope.avgCo2Class = classifyCO2(0);
            var avgSpeed_kph =
              speedAvg.queue.length > 0
                ? calculateAverage(
                    speedAvg.queue.map(function (s) {
                      return s.speed;
                    })
                  ) * 3.6
                : 0;
            var topSpeed_kph =
              (speedAvg.queue.length > 0
                ? Math.max.apply(
                    null,
                    speedAvg.queue.map(function (s) {
                      return s.speed;
                    })
                  )
                : 0) * 3.6;
            var topSpeedValid = topSpeed_kph <= 120;
            $scope.avgCo2Compliant =
              distance_m > 0 &&
              avgSpeed_kph >= 18 &&
              avgSpeed_kph <= 65 &&
              topSpeedValid;
            $scope.data4 = formatDistance(Infinity, mode, 0);
            $scope.totalCost = (used_kcal * price).toFixed(2) + ' ' + $scope.currency;
            $scope.avgCost =
              ((res.instPer100km / 100) * price).toFixed(2) +
              ' ' +
              $scope.currency +
              '/' +
              labels.distance;
            $scope.instantCO2 = formatCO2(0, 0, mode);
            $scope.co2Class = classifyCO2(0);
            updateFoodHistories(
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
              AVG_MAX_ENTRIES,
              MAX_EFFICIENCY
            );
            lastDistance_m = distance_m;
            return;
          }
          if (!streams.engineInfo || !streams.electrics) return;
          if (!lastFuelType) fetchFuelType();

          var now_ms = performance.now();
          var dt = Math.max(0, (now_ms - lastTime_ms) / 1000);
          lastTime_ms = now_ms;

          var speed_mps = resolveSpeed(
            streams.electrics.wheelspeed,
            streams.electrics.airspeed,
            EPS_SPEED
          );
          var deltaDistance = speed_mps * dt;
          // Track speeds over a time window for EU compliance.
          speedAvg.queue.push({ speed: Math.abs(speed_mps), time: now_ms });
          while (
            speedAvg.queue.length > 0 &&
            now_ms - speedAvg.queue[0].time > EU_SPEED_WINDOW_MS
          ) {
            speedAvg.queue.shift();
          }
          var trip_m = streams.electrics.trip || 0;

          var currentFuel_l = streams.engineInfo[11];
          var capacity_l = streams.engineInfo[12];
          var throttle = streams.electrics.throttle_input || 0;
          var engineTemp_c = streams.engineInfo[13] || 0;
          var n2oActive = !!(streams.electrics && streams.electrics.n2oActive);
          var engineRunning = isEngineRunning(streams.electrics, streams.engineInfo);
          if (!engineRunning && engineWasRunning) {
            // Engine was just turned off – clear instant and average
            // histories so subsequent runs start fresh.
            resetInstantHistory();
            resetAvgHistory();
          }
          engineWasRunning = engineRunning;
          if (!engineRunning) {
            idleFuelFlow_lps = 0;
            idleRpm = 0;
          }

          if (!Number.isFinite(currentFuel_l) || !Number.isFinite(capacity_l)) return;

          if (lastCapacity_l !== null && capacity_l !== lastCapacity_l) {
            $log.debug('<ok-fuel-economy> capacity changed -> reset trip');
            hardReset(true);
          }
          lastCapacity_l = capacity_l;

          if (startFuel_l === null) {
            startFuel_l = currentFuel_l;
            distance_m = 0;
          }
          if (previousFuel_l === null) {
            previousFuel_l = currentFuel_l;
            distance_m = 0;
          }

          if (currentFuel_l <= 0 && previousFuel_l > 0.1) {
            currentFuel_l = previousFuel_l;
          }

          var fuel_used_l = startFuel_l - currentFuel_l;
          if (fuel_used_l >= capacity_l || fuel_used_l < 0) {
            startFuel_l = currentFuel_l;
            previousFuel_l = currentFuel_l;
            fuel_used_l = 0;
            distance_m = 0;
          }

          if (engineRunning) {
            var deltaTripFuel = previousFuel_l - currentFuel_l;
            if (Math.abs(deltaTripFuel) < capacity_l) {
              var deltaFuelUnit = convertVolumeToUnit(deltaTripFuel, $scope.unitMode);
              if ($scope.unitMode === 'electric') {
                tripFuelUsedElectric_l += deltaTripFuel;
                overall.fuelUsedElectric = tripFuelUsedElectric_l;
                tripCostElectric += deltaFuelUnit * $scope.electricityPriceValue;
                var electricDelta = Math.max(0, deltaTripFuel);
                var co2Factor = calculateCO2Factor(
                  'Electricity',
                  engineTemp_c,
                  n2oActive,
                  true
                );
                var noxFactor = calculateNOxFactor(
                  'Electricity',
                  engineTemp_c,
                  n2oActive,
                  true
                );
                tripCo2_g += electricDelta * co2Factor;
                tripNox_g += electricDelta * noxFactor;
              } else if (deltaTripFuel > 0) {
                tripFuelUsedLiquid_l += deltaTripFuel;
                overall.fuelUsedLiquid = tripFuelUsedLiquid_l;
                tripCostLiquid += deltaFuelUnit * $scope.liquidFuelPriceValue;
                var co2Factor = calculateCO2Factor(
                  $scope.fuelType,
                  engineTemp_c,
                  n2oActive,
                  false
                );
                var noxFactor = calculateNOxFactor(
                  $scope.fuelType,
                  engineTemp_c,
                  n2oActive,
                  false
                );
                tripCo2_g += deltaTripFuel * co2Factor;
                tripNox_g += deltaTripFuel * noxFactor;
              }
              overall.tripCo2 = tripCo2_g;
              overall.tripNox = tripNox_g;
            }
            if (speed_mps > EPS_SPEED) {
              if ($scope.unitMode === 'electric') {
                tripDistanceElectric_m += deltaDistance;
              } else {
                tripDistanceLiquid_m += deltaDistance;
              }
            }
            overall.tripCostLiquid = tripCostLiquid;
            overall.tripCostElectric = tripCostElectric;
            overall.tripDistanceLiquid = tripDistanceLiquid_m;
            overall.tripDistanceElectric = tripDistanceElectric_m;
            if (now_ms - (overall.lastCostSaveTime || 0) >= 100) {
              saveOverall();
              overall.lastCostSaveTime = now_ms;
            }
          }

          if (distance_m === 0 && lastDistance_m > 0) {
            resetAvgHistory();
          }

          distance_m += deltaDistance;

          if (throttle <= 0.05 && lastThrottle > 0.05) {
            previousFuel_l = currentFuel_l;
          }
          var rawFuelFlow_lps = calculateFuelFlow(currentFuel_l, previousFuel_l, dt);
          var rpmTacho = normalizeRpm(
            streams.electrics.rpmTacho || 0,
            engineRunning
          );
          if (
            $scope.unitMode !== 'electric' &&
            throttle <= 0.05 &&
            rawFuelFlow_lps > 0
          ) {
            idleFuelFlow_lps =
              idleFuelFlow_lps > 0
                ? Math.min(idleFuelFlow_lps, rawFuelFlow_lps)
                : rawFuelFlow_lps;
            idleRpm = idleRpm > 0 ? Math.min(idleRpm, rpmTacho) : rpmTacho;
          }
          var fuelFlow_lps = smoothFuelFlow(
            rawFuelFlow_lps,
            speed_mps,
            throttle,
            lastFuelFlow_lps,
            idleFuelFlow_lps,
            idleRpm,
            rpmTacho,
            EPS_SPEED,
            $scope.unitMode === 'electric'
          );
          var sampleValid =
            (engineRunning || rpmTacho >= MIN_RPM_RUNNING) &&
            fuelFlow_lps >= 0;
          if (!sampleValid) {
            fuelFlow_lps = 0;
            lastFuelFlow_lps = 0;
          } else {
            lastFuelFlow_lps = fuelFlow_lps;
          }
          previousFuel_l = currentFuel_l;
          lastThrottle = throttle;

          var inst_l_per_h = sampleValid ? fuelFlow_lps * 3600 : 0;
          var inst_l_per_100km = sampleValid
            ? calculateInstantConsumption(fuelFlow_lps, speed_mps)
            : 0;
          var eff =
            Number.isFinite(inst_l_per_100km) && inst_l_per_100km > 0
              ? 100 / inst_l_per_100km
              : MAX_EFFICIENCY;
          eff = Math.min(eff, MAX_EFFICIENCY);
          if (now_ms - lastInstantUpdate_ms >= INSTANT_UPDATE_INTERVAL) {
            $scope.instantLph = formatFlow(inst_l_per_h, $scope.unitMode, 1);
            $scope.instantL100km = formatConsumptionRate(
              inst_l_per_100km,
              $scope.unitMode,
              1
            );
            $scope.instantKmL = formatEfficiency(eff, $scope.unitMode, 2);
            var co2_val = calculateCO2gPerKm(
              inst_l_per_100km,
              $scope.fuelType,
              engineTemp_c,
              n2oActive,
              $scope.unitMode === 'electric'
            );
            $scope.instantCO2 = formatCO2(co2_val, 0, $scope.unitMode);
            $scope.co2Class = classifyCO2(co2_val);
            lastInstantUpdate_ms = now_ms;
          }

          var avgSpeed_kph =
            speedAvg.queue.length > 0
              ? calculateAverage(
                  speedAvg.queue.map(function (s) {
                    return s.speed;
                  })
                ) * 3.6
              : 0;
          var topSpeed_kph =
            (speedAvg.queue.length > 0
              ? Math.max.apply(
                  null,
                  speedAvg.queue.map(function (s) {
                    return s.speed;
                  })
                )
              : 0) * 3.6;
          var topSpeedValid = topSpeed_kph <= 120;
          $scope.avgCo2Compliant =
            distance_m > 0 &&
            avgSpeed_kph >= 18 &&
            avgSpeed_kph <= 65 &&
            topSpeedValid;

          if (!engineRunning && initialized) {
            previousFuel_l = currentFuel_l;
            lastThrottle = throttle;
            return;
          }

          if (sampleValid) {
            instantHistory.queue.push(inst_l_per_h);
            trimQueue(instantHistory.queue, INSTANT_MAX_ENTRIES);
            $scope.instantHistory = buildQueueGraphPoints(instantHistory.queue, 100, 40);
            instantEffHistory.queue.push(Number.isFinite(eff) ? eff : MAX_EFFICIENCY);
            trimQueue(instantEffHistory.queue, INSTANT_MAX_ENTRIES);
            $scope.instantKmLHistory = buildQueueGraphPoints(instantEffHistory.queue, 100, 40);
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
          } else {
            resetInstantHistory();
          }

          var avg_l_per_100km_ok = resolveAverageConsumption(
            sampleValid,
            inst_l_per_100km,
            avgRecent,
            AVG_MAX_ENTRIES
          );
          if (
            !Number.isFinite(avg_l_per_100km_ok) ||
            avg_l_per_100km_ok > MAX_CONSUMPTION
          ) {
            avg_l_per_100km_ok = 0;
          }
          var avgCo2Val = calculateCO2gPerKm(
            avg_l_per_100km_ok,
            $scope.fuelType,
            engineTemp_c,
            n2oActive,
            $scope.unitMode === 'electric'
          );

          // ---------- Overall update (NEW) ----------
          if (sampleValid) {
            overall.queue.push(avg_l_per_100km_ok);
            trimQueue(overall.queue, MAX_ENTRIES);
            overall.co2Queue.push(avgCo2Val);
            trimQueue(overall.co2Queue, MAX_ENTRIES);

            if (speed_mps > EPS_SPEED) {
              overall.distance = (overall.distance || 0) + deltaDistance;
            }

            overall.previousAvg = avg_l_per_100km_ok;

            if (!overall.lastSaveTime) overall.lastSaveTime = 0;
            var now = performance.now();
            if (now - overall.lastSaveTime >= 100) {
              saveOverall();
              overall.lastSaveTime = now;
            }
          }


          // Use the median of the recorded averages for trip stats and graphs
          var overall_median = calculateMedian(overall.queue);
          var tripAvgCo2Val = calculateMedian(overall.co2Queue);
          $scope.tripAvgHistory = buildQueueGraphPoints(overall.queue, 100, 40);
          $scope.tripAvgKmLHistory = buildQueueGraphPoints(
            overall.queue.map(function (v) {
              return v > 0 ? Math.min(100 / v, MAX_EFFICIENCY) : MAX_EFFICIENCY;
            }),
            100,
            40
          );

          // ---------- Average Consumption ----------
          if (sampleValid) {
            overall.previousAvgTrip = avg_l_per_100km_ok;

            avgHistory.queue.push(avg_l_per_100km_ok);
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
            // Record the resolved speed (airspeed or wheelspeed) for EU compliance checks.
            // (handled globally above)
          } else {
            avgHistory = { queue: [] };
            $scope.avgHistory = '';
            $scope.avgKmLHistory = '';
          }

          var mode = getActiveUnitMode();
          var rangeVal = calculateRange(currentFuel_l, avg_l_per_100km_ok, speed_mps, EPS_SPEED);
          var rangeStr = Number.isFinite(rangeVal)
                         ? formatDistance(rangeVal, mode, 0)
                         : 'Infinity';

          var rangeOverallMedianVal = calculateRange(currentFuel_l, overall_median, speed_mps, EPS_SPEED);
          var rangeOverallMedianStr = Number.isFinite(rangeOverallMedianVal)
                         ? formatDistance(rangeOverallMedianVal, mode, 0)
                         : 'Infinity';

          var unitLabels = getUnitLabels(mode);
          var priceForMode =
            mode === 'electric'
              ? $scope.electricityPriceValue
              : $scope.liquidFuelPriceValue;
          updateCostPrice(unitLabels, priceForMode);

          var fuelUsedUnit = convertVolumeToUnit(fuel_used_l, mode);
          var totalCostVal = fuelUsedUnit * priceForMode;
          $scope.totalCost = totalCostVal.toFixed(2) + ' ' + $scope.currency;

          var avgLitersPerKm = avg_l_per_100km_ok / 100;
          var avgVolPerDistUnit = convertVolumePerDistance(avgLitersPerKm, mode);
          var avgCostVal = avgVolPerDistUnit * priceForMode;
          $scope.avgCost =
            avgCostVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance;

          var medianLitersPerKm = overall_median / 100;
          var medianVolPerDistUnit = convertVolumePerDistance(medianLitersPerKm, mode);
          var tripAvgCostLiquidVal = medianVolPerDistUnit * $scope.liquidFuelPriceValue;
          var tripAvgCostElectricVal = medianVolPerDistUnit * $scope.electricityPriceValue;
          $scope.tripAvgCostLiquid =
            tripAvgCostLiquidVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance;
          $scope.tripAvgCostElectric =
            tripAvgCostElectricVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance;
          $scope.tripTotalCostLiquid =
            tripCostLiquid.toFixed(2) + ' ' + $scope.currency;
          $scope.tripTotalCostElectric =
            tripCostElectric.toFixed(2) + ' ' + $scope.currency;
          var liquidUnitMode = mode === 'imperial' ? 'imperial' : 'metric';
          $scope.tripFuelUsedLiquid = formatVolume(
            tripFuelUsedLiquid_l,
            liquidUnitMode,
            2
          );
          $scope.tripFuelUsedElectric = formatVolume(
            tripFuelUsedElectric_l,
            'electric',
            2
          );

          $scope.data1 = formatDistance(distance_m, mode, 1);
          $scope.fuelUsed = formatVolume(fuel_used_l, mode, 2);
          $scope.fuelLeft = formatVolume(currentFuel_l, mode, 2);
          $scope.fuelCap = formatVolume(capacity_l, mode, 1);
          $scope.avgL100km = formatConsumptionRate(avg_l_per_100km_ok, mode, 1);
          $scope.avgKmL = formatEfficiency(
            avg_l_per_100km_ok > 0 ? 100 / avg_l_per_100km_ok : Infinity,
            mode,
            2
          );
          $scope.avgCO2 = formatCO2(avgCo2Val, 0, mode);
          $scope.avgCo2Class = classifyCO2(avgCo2Val);
          $scope.data4 = rangeStr;
          $scope.data6 = formatDistance(trip_m, mode, 1);
          $scope.tripAvgL100km = formatConsumptionRate(overall_median, mode, 1);
          $scope.tripAvgKmL = formatEfficiency(
            overall_median > 0 ? 100 / overall_median : Infinity,
            mode,
            2
          );
          $scope.tripAvgCO2 = formatCO2(tripAvgCo2Val, 0, mode);
          $scope.tripCo2Class = classifyCO2(tripAvgCo2Val);
          $scope.tripTotalCO2 = tripCo2_g > 0 ? formatMass(tripCo2_g) : '';
          $scope.tripTotalNOx = tripNox_g > 0 ? formatMass(tripNox_g) : '';
          $scope.data8 = formatDistance(overall.distance, mode, 1);
          $scope.data9 = rangeOverallMedianStr;
          $scope.vehicleNameStr = bngApi.engineLua("be:getPlayerVehicle(0)");

          if (webEndpointRunning && bngApi && typeof bngApi.engineLua === 'function') {
            var payload = {
              distanceMeasured: $scope.data1,
              distanceEcu: $scope.data6,
              fuelUsed: $scope.fuelUsed,
              fuelLeft: $scope.fuelLeft,
              fuelCap: $scope.fuelCap,
              avgL100km: $scope.avgL100km,
              avgKmL: $scope.avgKmL,
              range: $scope.data4,
              instantLph: $scope.instantLph,
              instantL100km: $scope.instantL100km,
              instantKmL: $scope.instantKmL,
              tripAvgL100km: $scope.tripAvgL100km,
              tripAvgKmL: $scope.tripAvgKmL,
              avgCO2: $scope.avgCO2,
              tripAvgCO2: $scope.tripAvgCO2,
              tripCo2Class: $scope.tripCo2Class,
              costPrice: $scope.costPrice,
              avgCost: $scope.avgCost,
              totalCost: $scope.totalCost,
              tripAvgCostLiquid: $scope.tripAvgCostLiquid,
              tripAvgCostElectric: $scope.tripAvgCostElectric,
              tripTotalCostLiquid: $scope.tripTotalCostLiquid,
              tripTotalCostElectric: $scope.tripTotalCostElectric,
              tripFuelUsedLiquid: $scope.tripFuelUsedLiquid,
              tripFuelUsedElectric: $scope.tripFuelUsedElectric,
              tripTotalCO2: $scope.tripTotalCO2,
              tripTotalNOx: $scope.tripTotalNOx,
              vehicleName: $scope.vehicleNameStr
            };
            bngApi.engineLua('extensions.okWebServer.setData(' + JSON.stringify(JSON.stringify(payload)) + ')');
          }

          lastDistance_m = distance_m;
          initialized = true;
        });
      });
    }]
  };
}]);
