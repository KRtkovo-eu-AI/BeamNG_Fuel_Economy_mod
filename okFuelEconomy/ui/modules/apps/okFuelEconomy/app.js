function calculateFuelFlow(currentFuel, previousFuel, dtSeconds) {
  if (dtSeconds <= 0 || previousFuel === null) return 0;
  return (previousFuel - currentFuel) / dtSeconds; // L/s
}

function calculateInstantConsumption(fuelFlow_lps, speed_mps) {
  if (speed_mps === 0) return Infinity;
  return (fuelFlow_lps / speed_mps) * 100000;
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

      // UI outputs
      $scope.data1 = ''; // distance
      $scope.data6 = ''; // trip
      $scope.data2 = ''; // fuel used / left / cap
      $scope.data3 = ''; // avg consumption
      $scope.data4 = ''; // range
      $scope.data5 = ''; // instant consumption
      $scope.data7 = ''; // overall average

      var distance_m = 0;
      var lastTime_ms = performance.now();
      var startFuel_l = null;
      var previousFuel_l = null;

      var lastCapacity_l = null;
      var EPS_SPEED = 0.005; // [m/s] ignore noise

      $scope.vehicleNameStr = "";

      // --------- Overall persistence (NEW) ----------
      var OVERALL_KEY = 'okFuelEconomyOverall';

      // dlouhodobé ukládání průměrné spotřeby a ujeté vzdálenosti
      var overall = { avg: 0, count: 0, distance: 0 };
      try {
          var saved = JSON.parse(localStorage.getItem(OVERALL_KEY));
          if (saved && typeof saved.avg === 'number' && typeof saved.count === 'number') {
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
          overall = { avg: 0, count: 0, distance: 0 };
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

          var fuelFlow_lps = calculateFuelFlow(currentFuel_l, previousFuel_l, dt);
          previousFuel_l = currentFuel_l;

          var inst_l_per_h = fuelFlow_lps * 3600;
          var inst_l_per_100km = calculateInstantConsumption(fuelFlow_lps, speed_mps);
          var instantStr = inst_l_per_h.toFixed(1) + ' L/h (' + inst_l_per_100km.toFixed(1) + ' L/100km)';

          // ---------- Overall update (NEW) ----------
          var deltaDistance = speed_mps * dt;
          if (!overall.previousAvg) overall.previousAvg = 0;

          var throttle = streams.electrics.throttle_input || 0;
          var shouldPush = false;

          if (speed_mps > EPS_SPEED) {
              shouldPush = true; // vozidlo jede → libovolný růst
          } else if (throttle > 0.2) {
              shouldPush = true; // stojí, ale motor v zátěži → libovolný růst
          } else if (avg_l_per_100km_ok <= overall.previousAvg) {
              // stojí, motor volnoběh → jen pokud průměrná spotřeba neklesá
              shouldPush = true;
          }

          if (shouldPush && avg_l_per_100km_ok > 0) {
              overall.avg = (overall.avg * overall.count + avg_l_per_100km_ok) / (overall.count + 1);
              overall.count += 1;

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

          var overall_avg = overall.avg;

          // ---------- Average Consumption rules (prevent increasing while stopped) ----------
          var throttle = streams.electrics.throttle_input || 0;
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

          var rangeOverallVal = calculateRange(currentFuel_l, overall_avg, speed_mps, EPS_SPEED);
          var rangeOverallStr = Number.isFinite(rangeOverallVal)
                         ? UiUnits.buildString('distance', rangeOverallVal, 0)
                         : 'Infinity';

          $scope.data1 = UiUnits.buildString('distance', distance_m, 1);
          $scope.data2 = fuel_used_l.toFixed(2) + ' L used / ' +
                         UiUnits.buildString('volume', currentFuel_l, 2) + ' left / ' +
                         UiUnits.buildString('volume', capacity_l, 1) + ' cap';
          $scope.data3 = UiUnits.buildString('consumptionRate', avg_l_per_100km_ok, 1);
          $scope.data4 = rangeStr;
          $scope.data5 = instantStr;
          $scope.data6 = UiUnits.buildString('distance', trip_m, 1);
          $scope.data7 = UiUnits.buildString('consumptionRate', overall_avg, 1);
          $scope.data8 = UiUnits.buildString('distance', overall.distance, 1);
          $scope.data9 = rangeOverallStr;
          $scope.vehicleNameStr = bngApi.engineLua("be:getPlayerVehicle(0)");
        });
      });
    }]
  };
}]);
