function calculateFuelFlow(currentFuel, previousFuel, dtSeconds) {
  if (dtSeconds <= 0 || previousFuel === null) return 0;
  return (previousFuel - currentFuel) / dtSeconds; // L/s
}

function calculateInstantConsumption(fuelFlow_lps, speed_mps) {
  if (speed_mps === 0) return Infinity;
  return (fuelFlow_lps / speed_mps) * 100000;
}

// Resolve the fuel flow when sensor readings are static.
// - While accelerating (throttle > 0) keep the last measured flow.
// - While coasting with zero throttle, ease the previous reading toward the
//   stored idle flow so the value keeps updating instead of freezing at the
//   last accelerating reading.
function smoothFuelFlow(
  fuelFlow_lps,
  speed_mps,
  throttle,
  lastFuelFlow_lps,
  idleFuelFlow_lps,
  EPS_SPEED
) {
  if (fuelFlow_lps > 0 && throttle > 0.05) {
    // A fresh reading while throttle is applied – use it directly.
    return fuelFlow_lps;
  }

  const target = idleFuelFlow_lps > 0 ? idleFuelFlow_lps : 0;

  if (speed_mps > EPS_SPEED) {
    if (throttle <= 0.05) {
      // Coasting with zero throttle – blend previous value toward idle.
      return lastFuelFlow_lps + (target - lastFuelFlow_lps) * 0.1;
    }
    // Throttle applied but sensor static – keep the last flow.
    return lastFuelFlow_lps;
  }

  // Vehicle stopped: smoothly approach idle flow.
  return lastFuelFlow_lps + (target - lastFuelFlow_lps) * 0.1;
}

function trimQueue(queue, maxEntries) {
  while (queue.length > maxEntries) {
    queue.shift();
  }
}

function calculateMedian(queue) {
  if (!Array.isArray(queue) || queue.length === 0) return 0;
  var sorted = queue.slice().sort(function (a, b) { return a - b; });
  var mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
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

if (typeof module !== 'undefined') {
  module.exports = {
    calculateFuelFlow,
    calculateInstantConsumption,
    smoothFuelFlow,
    trimQueue,
    calculateMedian,
    calculateAverageConsumption,
    calculateRange,
    buildQueueGraphPoints,
    resolveSpeed,
    getUnitLabels,
    formatDistance,
    formatVolume,
    formatConsumptionRate,
    formatEfficiency,
    formatFlow,
    convertVolumeToUnit,
    convertDistanceToUnit,
    convertVolumePerDistance
  };
}

angular.module('beamng.apps')
.directive('okFuelEconomy', [function () {
  return {
    templateUrl: '/ui/modules/apps/okFuelEconomy/app.html',
    replace: true,
    restrict: 'EA',
    scope: true,
    controller: ['$log', '$scope', '$http', function ($log, $scope, $http) {
      var streamsList = ['electrics', 'engineInfo'];
      StreamsManager.add(streamsList);

      $scope.fuelPriceValue = 0;
      $scope.currency = 'money';
      $http.get('/ui/modules/apps/okFuelEconomy/app.json')
        .then(function (resp) {
          $scope.fuelPriceValue = parseFloat((resp.data || {}).fuelPrice) || 0;
          $scope.currency = (resp.data || {}).currency || 'money';
        })
        .catch(function () {
          $scope.fuelPriceValue = 0;
          $scope.currency = 'money';
        });

      $scope.$on('$destroy', function () {
        StreamsManager.remove(streamsList);
      });

      // Settings for visible fields
      var SETTINGS_KEY = 'okFuelEconomyVisible';
      var UNIT_MODE_KEY = 'okFuelEconomyUnitMode';
      $scope.settingsOpen = false;
      $scope.unitModeLabels = {
        metric: 'Metric (L, km)',
        imperial: 'Imperial (gal, mi)',
        electric: 'Electric (kWh, km)'
      };
      $scope.unitMenuOpen = false;
      $scope.unitMode = localStorage.getItem(UNIT_MODE_KEY) || 'metric';
      $scope.setUnit = function (mode) {
        $scope.unitMode = mode;
        updateUnitLabels();
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
      $scope.visible = {
        heading: true,
        distanceMeasured: true,
        distanceEcu: true,
        fuelUsed: true,
        fuelLeft: true,
        fuelCap: true,
        avgL100km: true,
        avgKmL: true,
        avgGraph: true,
        avgKmLGraph: true,
        instantLph: true,
        instantL100km: true,
        instantKmL: true,
        instantGraph: true,
        instantKmLGraph: true,
        range: true,
        tripAvgL100km: true,
        tripAvgKmL: true,
        tripGraph: true,
        tripKmLGraph: true,
        tripDistance: true,
        tripRange: true,
        tripReset: true,
        costPrice: false,
        costTotal: false,
        costPerDistance: false,
        tripCostTotal: false,
        tripCostPerDistance: false
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
          Object.assign($scope.visible, s);
        }
      } catch (e) { /* ignore */ }

      $scope.saveSettings = function () {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify($scope.visible));
          localStorage.setItem(UNIT_MODE_KEY, $scope.unitMode);
        } catch (e) { /* ignore */ }
        $scope.settingsOpen = false;
      };

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
      $scope.tripAvgHistory = '';
      $scope.tripAvgKmLHistory = '';
      $scope.avgHistory = '';
      $scope.avgKmLHistory = '';
      $scope.instantHistory = '';
      $scope.instantKmLHistory = '';
      $scope.costPrice = '';
      $scope.costTotal = '';
      $scope.costPerDistance = '';
      $scope.tripCostTotal = '';
      $scope.tripCostPerDistance = '';

      var distance_m = 0;
      var lastDistance_m = 0;
      var lastTime_ms = performance.now();
      var startFuel_l = null;
      var previousFuel_l = null;
      var lastFuelFlow_lps = 0; // last smoothed value
      var idleFuelFlow_lps = 0;
      var lastThrottle = 0;
      var engineWasRunning = false;

      var lastCapacity_l = null;
      var EPS_SPEED = 0.005; // [m/s] ignore noise
      var lastInstantUpdate_ms = 0;
      var INSTANT_UPDATE_INTERVAL = 250;
      var MAX_CONSUMPTION = 1000; // [L/100km] ignore unrealistic spikes
      var MAX_EFFICIENCY = 100; // [km/L] cap unrealistic efficiency

      $scope.vehicleNameStr = "";

      // --------- Overall persistence (NEW) ----------
      var OVERALL_KEY = 'okFuelEconomyOverall';
      var MAX_ENTRIES = 5000; // pevný počet hodnot pro frontu

      var overall = { queue: [], distance: 0 }; // fronta posledních průměrů + celková ujetá vzdálenost
      try {
          var saved = JSON.parse(localStorage.getItem(OVERALL_KEY));
          if (saved && Array.isArray(saved.queue)) {
              overall = saved;
          }
      } catch (e) { /* ignore */ }

      function saveOverall() {
          try { localStorage.setItem(OVERALL_KEY, JSON.stringify(overall)); } catch (e) { /* ignore */ }
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
      }

      function hardReset() {
        distance_m = 0;
        lastDistance_m = 0;
        startFuel_l = null;
        previousFuel_l = null;
        lastTime_ms = performance.now();
        $scope.vehicleNameStr = "";
        engineWasRunning = false;
        resetInstantHistory();
        resetAvgHistory();
      }

      $scope.reset = function () {
        $log.debug('<ok-fuel-economy> manual reset');
        hardReset();
      };

      // reset overall včetně vzdálenosti
      $scope.resetOverall = function () {
          $log.debug('<ok-fuel-economy> manual reset overall');
          overall = { queue: [], distance: 0 };
          saveOverall();
          avgHistory = { queue: [] };
          saveAvgHistory();
          resetInstantHistory();
          $scope.tripAvgL100km = formatConsumptionRate(0, $scope.unitMode, 1);
          $scope.tripAvgKmL = formatEfficiency(Infinity, $scope.unitMode, 2);
          $scope.data6 = formatDistance(0, $scope.unitMode, 1); // reset trip
          $scope.tripAvgHistory = '';
          $scope.tripAvgKmLHistory = '';
          $scope.avgHistory = '';
          $scope.avgKmLHistory = '';
      };

      $scope.$on('VehicleFocusChanged', function () {
        $log.debug('<ok-fuel-economy> vehicle changed -> reset trip');
        hardReset();
      });

      $scope.$on('streamsUpdate', function (event, streams) {
        $scope.$evalAsync(function () {
          if (!streams.engineInfo || !streams.electrics) return;

          var now_ms = performance.now();
          var dt = Math.max(0, (now_ms - lastTime_ms) / 1000);
          lastTime_ms = now_ms;

          var speed_mps = resolveSpeed(
            streams.electrics.wheelspeed,
            streams.electrics.airspeed,
            EPS_SPEED
          );
          var trip_m = streams.electrics.trip || 0;

          var currentFuel_l = streams.engineInfo[11];
          var capacity_l = streams.engineInfo[12];
          var throttle = streams.electrics.throttle_input || 0;
          var rpm = streams.electrics.rpmTacho || 0;
          var engineRunning = rpm > 0;
          if (!engineRunning && engineWasRunning) {
            resetInstantHistory();
          }
          engineWasRunning = engineRunning;
          if (!engineRunning) {
            idleFuelFlow_lps = 0;
          }

          if (!Number.isFinite(currentFuel_l) || !Number.isFinite(capacity_l)) return;

          if (lastCapacity_l !== null && capacity_l !== lastCapacity_l) {
            $log.debug('<ok-fuel-economy> capacity changed -> reset trip');
            hardReset();
          }
          lastCapacity_l = capacity_l;

          if (startFuel_l === null || startFuel_l === 0) {
            startFuel_l = currentFuel_l;
            distance_m = 0;
          }
          if (previousFuel_l === null) {
            previousFuel_l = currentFuel_l;
            distance_m = 0;
          } 

          var fuel_used_l = startFuel_l - currentFuel_l;
          if (fuel_used_l >= capacity_l || fuel_used_l < 0) {
            fuel_used_l = 0;
            distance_m = 0;
          }

          if (distance_m === 0 && lastDistance_m > 0) {
            resetAvgHistory();
          }

          distance_m += speed_mps * dt;

          var avg_l_per_100km_ok = calculateAverageConsumption(fuel_used_l, distance_m);
          if (!Number.isFinite(avg_l_per_100km_ok) || avg_l_per_100km_ok > MAX_CONSUMPTION) {
            avg_l_per_100km_ok = 0;
          }

          if (throttle <= 0.05 && lastThrottle > 0.05) {
            previousFuel_l = currentFuel_l;
          }
          var rawFuelFlow_lps = calculateFuelFlow(currentFuel_l, previousFuel_l, dt);
          if (speed_mps <= EPS_SPEED && throttle <= 0.05 && rawFuelFlow_lps > 0) {
            idleFuelFlow_lps = rawFuelFlow_lps;
          }
          var fuelFlow_lps = smoothFuelFlow(
            rawFuelFlow_lps,
            speed_mps,
            throttle,
            lastFuelFlow_lps,
            idleFuelFlow_lps,
            EPS_SPEED
          );
          if (!engineRunning) {
            fuelFlow_lps = 0;
            lastFuelFlow_lps = 0;
          } else {
            lastFuelFlow_lps = fuelFlow_lps;
          }
          previousFuel_l = currentFuel_l;
          lastThrottle = throttle;

          var inst_l_per_h = fuelFlow_lps * 3600;
          var inst_l_per_100km = engineRunning
            ? calculateInstantConsumption(fuelFlow_lps, speed_mps)
            : 0;
          var eff =
            Number.isFinite(inst_l_per_100km) && inst_l_per_100km > 0
              ? 100 / inst_l_per_100km
              : MAX_EFFICIENCY;
          eff = Math.min(eff, MAX_EFFICIENCY);
          if (now_ms - lastInstantUpdate_ms >= INSTANT_UPDATE_INTERVAL) {
            $scope.instantLph = formatFlow(inst_l_per_h, $scope.unitMode, 1);
            if (Number.isFinite(inst_l_per_100km)) {
              $scope.instantL100km = formatConsumptionRate(
                inst_l_per_100km,
                $scope.unitMode,
                1
              );
            } else {
              $scope.instantL100km = 'Infinity';
            }
            $scope.instantKmL = formatEfficiency(eff, $scope.unitMode, 2);
            lastInstantUpdate_ms = now_ms;
          }

          if (engineRunning) {
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
          }

          // ---------- Overall update (NEW) ----------
          if (engineRunning) {
            var deltaDistance = speed_mps * dt;
            if (!overall.previousAvg) overall.previousAvg = 0;

            var shouldPush = false;

            if (speed_mps > EPS_SPEED) {
                shouldPush = true; // vozidlo jede → libovolný růst
            } else {
                if (throttle > 0.2) {
                    shouldPush = true; // stojí, ale motor v zátěži → libovolný růst
                } else {
                    // stojí, motor volnoběh → jen pokud průměrná spotřeba neklesá
                    if (avg_l_per_100km_ok <= overall.previousAvg) {
                        shouldPush = true;
                    }
                }
            }

            if (shouldPush && avg_l_per_100km_ok > 0) {
                overall.queue.push(avg_l_per_100km_ok);
                trimQueue(overall.queue, MAX_ENTRIES);

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
          }


          // Use the median of the recorded averages for trip stats and graphs
          var overall_median = calculateMedian(overall.queue);
          $scope.tripAvgHistory = buildQueueGraphPoints(overall.queue, 100, 40);
          $scope.tripAvgKmLHistory = buildQueueGraphPoints(overall.queue.map(function(v){ return v > 0 ? 100 / v : 0; }), 100, 40);

          // ---------- Average Consumption rules (prevent increasing while stopped) ----------
          if (engineRunning) {
            if (!overall.previousAvgTrip) overall.previousAvgTrip = 0;
            var shouldUpdateAvg = false;

            if (speed_mps > EPS_SPEED) {
                shouldUpdateAvg = true;
            } else {
                if (throttle > 0.2) {
                    shouldUpdateAvg = true;
                } else if (avg_l_per_100km_ok <= overall.previousAvgTrip) {
                    shouldUpdateAvg = true;
                }
            }

            if (shouldUpdateAvg) {
                overall.previousAvgTrip = avg_l_per_100km_ok;
            } else {
                // při stání a bez plynu → spotřebu necháme beze změny
                avg_l_per_100km_ok = overall.previousAvgTrip;
            }

            if (avg_l_per_100km_ok > 0) {
                avgHistory.queue.push(avg_l_per_100km_ok);
                trimQueue(avgHistory.queue, AVG_MAX_ENTRIES);
                $scope.avgHistory = buildQueueGraphPoints(avgHistory.queue, 100, 40);
                $scope.avgKmLHistory = buildQueueGraphPoints(avgHistory.queue.map(function(v){ return v > 0 ? 100 / v : 0; }), 100, 40);
                if (!avgHistory.lastSaveTime) avgHistory.lastSaveTime = 0;
                if (now_ms - avgHistory.lastSaveTime >= 100) {
                    saveAvgHistory();
                    avgHistory.lastSaveTime = now_ms;
                }
            }
          }

          var rangeVal = calculateRange(currentFuel_l, avg_l_per_100km_ok, speed_mps, EPS_SPEED);
          var rangeStr = Number.isFinite(rangeVal)
                         ? formatDistance(rangeVal, $scope.unitMode, 0)
                         : 'Infinity';

          var rangeOverallMedianVal = calculateRange(currentFuel_l, overall_median, speed_mps, EPS_SPEED);
          var rangeOverallMedianStr = Number.isFinite(rangeOverallMedianVal)
                         ? formatDistance(rangeOverallMedianVal, $scope.unitMode, 0)
                         : 'Infinity';

          var unitLabels = getUnitLabels($scope.unitMode);
          $scope.costPrice =
            $scope.fuelPriceValue.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.volume;

          var fuelUsedUnit = convertVolumeToUnit(fuel_used_l, $scope.unitMode);
          var distanceUnit = convertDistanceToUnit(distance_m, $scope.unitMode);
          var costTotalVal = fuelUsedUnit * $scope.fuelPriceValue;
          $scope.costTotal = costTotalVal.toFixed(2) + ' ' + $scope.currency;
          var costPerDistVal = distanceUnit > 0 ? costTotalVal / distanceUnit : 0;
          $scope.costPerDistance =
            costPerDistVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance;

          var tripDistance_m = overall.distance;
          var tripFuelUsed_l = (overall_median / 100) * (tripDistance_m / 1000);
          var tripFuelUsedUnit = convertVolumeToUnit(tripFuelUsed_l, $scope.unitMode);
          var tripCostTotalVal = tripFuelUsedUnit * $scope.fuelPriceValue;
          $scope.tripCostTotal = tripCostTotalVal.toFixed(2) + ' ' + $scope.currency;
          var litersPerKm = overall_median / 100;
          var volPerDistUnit = convertVolumePerDistance(litersPerKm, $scope.unitMode);
          var tripCostPerDistVal = volPerDistUnit * $scope.fuelPriceValue;
          $scope.tripCostPerDistance =
            tripCostPerDistVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance;

          $scope.data1 = formatDistance(distance_m, $scope.unitMode, 1);
          $scope.fuelUsed = formatVolume(fuel_used_l, $scope.unitMode, 2);
          $scope.fuelLeft = formatVolume(currentFuel_l, $scope.unitMode, 2);
          $scope.fuelCap = formatVolume(capacity_l, $scope.unitMode, 1);
          $scope.avgL100km = formatConsumptionRate(avg_l_per_100km_ok, $scope.unitMode, 1);
          $scope.avgKmL = formatEfficiency(
            avg_l_per_100km_ok > 0 ? 100 / avg_l_per_100km_ok : Infinity,
            $scope.unitMode,
            2
          );
          $scope.data4 = rangeStr;
          $scope.data6 = formatDistance(trip_m, $scope.unitMode, 1);
          $scope.tripAvgL100km = formatConsumptionRate(overall_median, $scope.unitMode, 1);
          $scope.tripAvgKmL = formatEfficiency(
            overall_median > 0 ? 100 / overall_median : Infinity,
            $scope.unitMode,
            2
          );
          $scope.data8 = formatDistance(overall.distance, $scope.unitMode, 1);
          $scope.data9 = rangeOverallMedianStr;
          $scope.vehicleNameStr = bngApi.engineLua("be:getPlayerVehicle(0)");
          lastDistance_m = distance_m;
        });
      });
    }]
  };
}]);
