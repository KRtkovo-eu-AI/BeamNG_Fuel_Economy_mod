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
// - While coasting with zero throttle use the last known idle flow scaled by RPM.
function smoothFuelFlow(
  fuelFlow_lps,
  speed_mps,
  throttle,
  lastFuelFlow_lps,
  idleFuelFlow_lps,
  idleRPM,
  rpm,
  EPS_SPEED
) {
  if (fuelFlow_lps > 0) {
    return fuelFlow_lps;
  }
  if (speed_mps > EPS_SPEED) {
    if (throttle <= 0.05) {
      if (idleFuelFlow_lps > 0) {
        if (idleRPM > 0 && rpm > idleRPM) {
          return idleFuelFlow_lps * (idleRPM / rpm);
        }
        return idleFuelFlow_lps;
      }
      return lastFuelFlow_lps;
    }
    return lastFuelFlow_lps;
  }
  return idleFuelFlow_lps > 0 ? idleFuelFlow_lps : 0;
}

function trimQueue(queue, maxEntries) {
  while (queue.length > maxEntries) {
    queue.shift();
  }
}

function calculateRange(currentFuel_l, avg_l_per_100km_ok, speed_mps, EPS_SPEED) {
  if (avg_l_per_100km_ok > 0) {
    return currentFuel_l / avg_l_per_100km_ok;
  }
  return speed_mps > EPS_SPEED ? Infinity : 0;
}

if (typeof module !== 'undefined') {
  module.exports = {
    calculateFuelFlow,
    calculateInstantConsumption,
    smoothFuelFlow,
    trimQueue,
    calculateRange
  };
}

angular.module('beamng.apps')
.directive('okFuelEconomy', [function () {
  return {
    templateUrl: '/ui/modules/apps/okFuelEconomy/app.html',
    replace: true,
    restrict: 'EA',
    scope: true,
    controller: ['$log', '$scope', function ($log, $scope) {
      var streamsList = ['electrics', 'engineInfo'];
      StreamsManager.add(streamsList);

      $scope.$on('$destroy', function () {
        StreamsManager.remove(streamsList);
      });

      // Settings for visible fields
      var SETTINGS_KEY = 'okFuelEconomyVisible';
      $scope.settingsOpen = false;
      $scope.visible = {
        heading: true,
        distanceMeasured: true,
        distanceEcu: true,
        fuelUsed: true,
        fuelLeft: true,
        fuelCap: true,
        avg: true,
        instantLph: true,
        instantL100km: true,
        range: true,
        tripAvg: true,
        tripDistance: true,
        tripRange: true,
        tripReset: true
      };
      try {
        var s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (s && typeof s === 'object') {
          // backward compatibility for old "instant" flag
          if ('instant' in s && !('instantLph' in s) && !('instantL100km' in s)) {
            s.instantLph = s.instantL100km = s.instant;
            delete s.instant;
          }
          Object.assign($scope.visible, s);
        }
      } catch (e) { /* ignore */ }

      $scope.saveSettings = function () {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify($scope.visible)); } catch (e) { /* ignore */ }
        $scope.settingsOpen = false;
      };

      // UI outputs
      $scope.data1 = ''; // distance measured
      $scope.data6 = ''; // distance from ECU
      $scope.fuelUsed = '';
      $scope.fuelLeft = '';
      $scope.fuelCap = '';
      $scope.data3 = ''; // avg consumption
      $scope.data4 = ''; // range
      $scope.instantLph = '';
      $scope.instantL100km = '';
      $scope.data7 = ''; // overall average

      var distance_m = 0;
      var lastTime_ms = performance.now();
      var startFuel_l = null;
      var previousFuel_l = null;
      var lastFuelFlow_lps = 0;
      var idleFuelFlow_lps = 0;
      var idleRPM = 0;

      var lastCapacity_l = null;
      var EPS_SPEED = 0.005; // [m/s] ignore noise
      var lastInstantUpdate_ms = 0;
      var INSTANT_UPDATE_INTERVAL = 250;

      $scope.vehicleNameStr = "";

      // --------- Overall persistence (NEW) ----------
      var OVERALL_KEY = 'okFuelEconomyOverall';
      var MAX_ENTRIES = 2500; // pevný počet hodnot pro frontu

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

      function hardReset() {
        distance_m = 0;
        startFuel_l = null;
        previousFuel_l = null;
        lastTime_ms = performance.now();
        $scope.vehicleNameStr = "";
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
          $scope.data7 = UiUnits.buildString('consumptionRate', 0, 1);
          $scope.data6 = UiUnits.buildString('distance', 0, 1); // reset trip
      };

      $scope.$on('VehicleFocusChanged', function () {
        $log.debug('<ok-fuel-economy> vehicle changed -> reset trip');
        hardReset();
        $scope.vehicleNameStr = "";
      });

      $scope.$on('streamsUpdate', function (event, streams) {
        $scope.$evalAsync(function () {
          if (!streams.engineInfo || !streams.electrics) return;

          var now_ms = performance.now();
          var dt = Math.max(0, (now_ms - lastTime_ms) / 1000);
          lastTime_ms = now_ms;

          var speed_mps = streams.electrics.wheelspeed || 0;
          var trip_m = streams.electrics.trip || 0;
          if (Math.abs(speed_mps) < EPS_SPEED) speed_mps = 0;

          var currentFuel_l = streams.engineInfo[11];
          var capacity_l = streams.engineInfo[12];
          var rpm = streams.engineInfo[0] || 0;
          var throttle = streams.electrics.throttle_input || 0;

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

          distance_m += speed_mps * dt;

          var avg_l_per_100km_ok = (fuel_used_l / (distance_m * 10)) * 10;

          var rawFuelFlow_lps = calculateFuelFlow(currentFuel_l, previousFuel_l, dt);
          if (
            throttle <= 0.05 &&
            rawFuelFlow_lps > 0 &&
            (speed_mps <= EPS_SPEED || idleFuelFlow_lps === 0 || rawFuelFlow_lps <= idleFuelFlow_lps * 1.2)
          ) {
            idleFuelFlow_lps = rawFuelFlow_lps;
            idleRPM = rpm;
          }
          var fuelFlow_lps = smoothFuelFlow(
            rawFuelFlow_lps,
            speed_mps,
            throttle,
            lastFuelFlow_lps,
            idleFuelFlow_lps,
            idleRPM,
            rpm,
            EPS_SPEED
          );
          lastFuelFlow_lps = fuelFlow_lps;
          previousFuel_l = currentFuel_l;

          var inst_l_per_h = fuelFlow_lps * 3600;
          var inst_l_per_100km = calculateInstantConsumption(fuelFlow_lps, speed_mps);
          if (now_ms - lastInstantUpdate_ms >= INSTANT_UPDATE_INTERVAL) {
            $scope.instantLph = inst_l_per_h.toFixed(1) + ' L/h';
            $scope.instantL100km = Number.isFinite(inst_l_per_100km)
              ? inst_l_per_100km.toFixed(1) + ' L/100km'
              : 'Infinity';
            lastInstantUpdate_ms = now_ms;
          }

          // ---------- Overall update (NEW) ----------
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


          // Overall median: počítat z libovolného počtu prvků
          function median(arr) {
              if (arr.length === 0) return 0;
              const sorted = arr.slice().sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              if (sorted.length % 2 === 0) {
                  return (sorted[mid - 1] + sorted[mid]) / 2;
              } else {
                  return sorted[mid];
              }
          }

          var overall_median = median(overall.queue);
          // ---------- Overall update (NEW) ----------

          // ---------- Average Consumption rules (prevent increasing while stopped) ----------
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


          var rangeVal = calculateRange(currentFuel_l, avg_l_per_100km_ok, speed_mps, EPS_SPEED);
          var rangeStr = Number.isFinite(rangeVal)
                         ? UiUnits.buildString('distance', rangeVal, 0)
                         : 'Infinity';

          var rangeOverallMedianVal = calculateRange(currentFuel_l, overall_median, speed_mps, EPS_SPEED);
          var rangeOverallMedianStr = Number.isFinite(rangeOverallMedianVal)
                         ? UiUnits.buildString('distance', rangeOverallMedianVal, 0)
                         : 'Infinity';

          $scope.data1 = UiUnits.buildString('distance', distance_m, 1);
          $scope.fuelUsed = fuel_used_l.toFixed(2) + ' L';
          $scope.fuelLeft = UiUnits.buildString('volume', currentFuel_l, 2);
          $scope.fuelCap = UiUnits.buildString('volume', capacity_l, 1);
          $scope.data3 = UiUnits.buildString('consumptionRate', avg_l_per_100km_ok, 1);
          $scope.data4 = rangeStr;
          $scope.data6 = UiUnits.buildString('distance', trip_m, 1);
          $scope.data7 = UiUnits.buildString('consumptionRate', overall_median, 1);
          $scope.data8 = UiUnits.buildString('distance', overall.distance, 1);
          $scope.data9 = rangeOverallMedianStr;
          $scope.vehicleNameStr = bngApi.engineLua("be:getPlayerVehicle(0)");
        });
      });
    }]
  };
}]);
