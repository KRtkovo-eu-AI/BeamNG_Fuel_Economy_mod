const constants = require('./constants');
const calc = require('./calc');
const format = require('./format');
const emissions = require('./emissions');
const fuelType = require('./fuelType');
const food = require('./food');
const config = require('./config');

const {
  EPS_SPEED,
  MIN_VALID_SPEED_MPS,
  MIN_RPM_RUNNING,
  MAX_CONSUMPTION,
  MAX_ELECTRIC_CONSUMPTION,
  MAX_EFFICIENCY,
  FOOD_CAPACITY_KCAL,
  FOOD_REST_KCAL_PER_H,
  EU_SPEED_WINDOW_MS
} = constants;

const {
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
} = calc;

const {
  KM_PER_MILE,
  LITERS_PER_GALLON,
  getUnitLabels,
  formatDistance,
  formatVolume,
  formatConsumptionRate,
  formatEfficiency,
  formatFlow,
  convertVolumeToUnit,
  convertDistanceToUnit,
  convertVolumePerDistance,
  extractValueUnit
} = format;

const {
  DEFAULT_CO2_FACTORS_G_PER_L,
  DEFAULT_NOX_FACTORS_G_PER_L,
  DEFAULT_FUEL_EMISSIONS,
  CO2_FACTORS_G_PER_L,
  calculateCO2Factor,
  calculateCO2gPerKm,
  calculateNOxFactor,
  formatCO2,
  formatMass,
  classifyCO2,
  meetsEuCo2Limit,
  loadFuelEmissionsConfig,
  ensureFuelEmissionType
} = emissions;

const {
  formatFuelTypeLabel,
  resolveUnitModeForFuelType,
  resolveFuelType,
  shouldResetOnFoot
} = fuelType;

const {
  simulateFood,
  resetFoodSimulation,
  updateFoodHistories
} = food;

const {
  loadFuelPriceConfig,
  loadAvgConsumptionAlgorithm,
  saveAvgConsumptionAlgorithm
} = config;

module.exports = {
  EPS_SPEED,
  MIN_VALID_SPEED_MPS,
  MIN_RPM_RUNNING,
  MAX_CONSUMPTION,
  MAX_ELECTRIC_CONSUMPTION,
  MAX_EFFICIENCY,
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
  EU_SPEED_WINDOW_MS,
  shouldResetOnFoot,
  updateFoodHistories,
  loadFuelEmissionsConfig,
  ensureFuelEmissionType,
  loadFuelPriceConfig,
  loadAvgConsumptionAlgorithm,
  saveAvgConsumptionAlgorithm,
  CO2_FACTORS_G_PER_L,
  DEFAULT_CO2_FACTORS_G_PER_L,
  DEFAULT_NOX_FACTORS_G_PER_L,
  DEFAULT_FUEL_EMISSIONS,
  KM_PER_MILE,
  LITERS_PER_GALLON,
  formatMass,
  extractValueUnit
};

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
        var avgConsumptionAlgorithm = 'optimized';
        $scope.avgConsumptionAlgorithm = 'optimized';
        loadAvgConsumptionAlgorithm(function (val) {
          avgConsumptionAlgorithm = val === 'direct' ? 'direct' : 'optimized';
          if (typeof $scope.$evalAsync === 'function') {
            $scope.$evalAsync(function () {
              $scope.avgConsumptionAlgorithm = avgConsumptionAlgorithm;
            });
          } else {
            $scope.avgConsumptionAlgorithm = avgConsumptionAlgorithm;
          }
        });

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
        loadFuelEmissionsConfig();

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
        var emissionsTimer = setInterval(function () {
          loadFuelEmissionsConfig();
        }, pollMs);
      if (emissionsTimer.unref) emissionsTimer.unref();

      $scope.$on('$destroy', function () {
        StreamsManager.remove(streamsList);
        clearInterval(priceTimer);
        clearInterval(emissionsTimer);
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
          'extensions.load("fuelPriceEditor") extensions.fuelPriceEditor.setLiquidUnit("' + liquid + '") extensions.fuelPriceEditor.open()'
        );
      };
      $scope.openFuelEmissionsEditor = function ($event) {
        $event.preventDefault();
        var liquid = preferredLiquidUnit === 'imperial' ? 'gal' : 'L';
        fuelEmissionsEditorLoaded = true;
        bngApi.engineLua(
          'extensions.load("fuelEmissionsEditor") extensions.fuelEmissionsEditor.setLiquidUnit("' + liquid + '") extensions.fuelEmissionsEditor.open()'
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
        var preferredLiquidUnit = localStorage.getItem(PREFERRED_UNIT_KEY);
        if (preferredLiquidUnit !== 'imperial' && preferredLiquidUnit !== 'metric') {
          preferredLiquidUnit =
            $scope.unitMode === 'imperial' ? 'imperial' : 'metric';
          try {
            localStorage.setItem(PREFERRED_UNIT_KEY, preferredLiquidUnit);
          } catch (e) {
            /* ignore */
          }
        }
        var fuelPriceEditorLoaded = false;
        var fuelEmissionsEditorLoaded = false;
        var manualUnit = false;
        var lastFuelType = '';

        $scope.avgConsumptionAlgorithmLabels = {
          optimized: 'Optimized',
          direct: 'Direct'
        };
        $scope.avgConsumptionAlgorithmOptions = {
          optimized: $scope.avgConsumptionAlgorithmLabels.optimized,
          direct: $scope.avgConsumptionAlgorithmLabels.direct
        };
        $scope.avgConsumptionAlgorithmMenuOpen = false;
        $scope.setAvgConsumptionAlgorithm = function (algo) {
          $scope.avgConsumptionAlgorithm = algo;
          avgConsumptionAlgorithm = algo === 'direct' ? 'direct' : 'optimized';
          $scope.avgConsumptionAlgorithmMenuOpen = false;
        };

        function getActiveUnitMode() {
          return resolveUnitModeForFuelType(lastFuelType, $scope.unitMode);
        }
        $scope.setUnit = function (mode) {
          $scope.unitMode = mode;
          if (mode !== 'electric') {
            preferredLiquidUnit = mode;
            try { localStorage.setItem(PREFERRED_UNIT_KEY, preferredLiquidUnit); } catch (e) {}
            var liquid = preferredLiquidUnit === 'imperial' ? 'gal' : 'L';
            if (fuelPriceEditorLoaded) {
              bngApi.engineLua(
                'extensions.fuelPriceEditor.setLiquidUnit("' + liquid + '")'
              );
            }
            if (fuelEmissionsEditorLoaded) {
              bngApi.engineLua(
                'extensions.fuelEmissionsEditor.setLiquidUnit("' + liquid + '")'
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
          if ($scope.unitMode === 'food' && desired !== 'food') {
            $scope.unitMode = desired;
            updateUnitLabels();
            updateCostPrice();
            refreshCostOutputs();
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
              if (
                $scope.fuelType !== 'None' &&
                CO2_FACTORS_G_PER_L[$scope.fuelType] == null
              ) {
                ensureFuelEmissionType($scope.fuelType);
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
        tripFuelUsedLiquid: false,
        tripFuelUsedElectric: false,
        tripTotalCost: false,
        tripTotalCostLiquid: false,
        tripTotalCostElectric: false,
        tripTotalCO2: false,
        tripTotalNOx: false,
        tripAvgL100km: true,
        tripAvgKmL: true,
        tripGraph: true,
        tripKmLGraph: true,
        tripRange: true,
        tripAvgCost: false,
        tripAvgCostLiquid: false,
        tripAvgCostElectric: false,
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
          if ('tripFuelUsed' in s && !('tripFuelUsedLiquid' in s) && !('tripFuelUsedElectric' in s)) {
            s.tripFuelUsedLiquid = s.tripFuelUsedElectric = s.tripFuelUsed;
          }
          if ('tripTotalCost' in s && !('tripTotalCostLiquid' in s) && !('tripTotalCostElectric' in s)) {
            s.tripTotalCostLiquid = s.tripTotalCostElectric = s.tripTotalCost;
          }
          if ('tripAvgCost' in s && !('tripAvgCostLiquid' in s) && !('tripAvgCostElectric' in s)) {
            s.tripAvgCostLiquid = s.tripAvgCostElectric = s.tripAvgCost;
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

      $scope.webEndpointRunning = false;
      $scope.webEndpointPort = 23512;
      if ($scope.visible.webEndpoint && bngApi && typeof bngApi.engineLua === 'function') {
        bngApi.engineLua('extensions.load("okWebServer")');
        bngApi.engineLua('extensions.okWebServer.start()', function (portInit) {
          if (portInit) {
            var update = function () {
              $scope.webEndpointPort =
                parseInt(portInit, 10) || $scope.webEndpointPort;
            };
            if (typeof $scope.$evalAsync === 'function') $scope.$evalAsync(update);
            else update();
          }
        });
        $scope.webEndpointRunning = true;
      }

      $scope.saveSettings = function () {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify($scope.visible));
            localStorage.setItem(UNIT_MODE_KEY, $scope.unitMode);
            if (
              $scope.unitMode === 'imperial' ||
              $scope.unitMode === 'metric'
            ) {
              localStorage.setItem(PREFERRED_UNIT_KEY, $scope.unitMode);
            }
        } catch (e) { /* ignore */ }

        avgConsumptionAlgorithm =
          $scope.avgConsumptionAlgorithm === 'direct' ? 'direct' : 'optimized';
        saveAvgConsumptionAlgorithm(avgConsumptionAlgorithm);

        if ($scope.visible.webEndpoint) {
          if (bngApi && typeof bngApi.engineLua === 'function') {
            bngApi.engineLua('extensions.load("okWebServer")');
            bngApi.engineLua('extensions.okWebServer.start()', function (port) {
              if (port) {
                var update = function () {
                  $scope.webEndpointPort =
                    parseInt(port, 10) || $scope.webEndpointPort;
                };
                if (typeof $scope.$evalAsync === 'function') $scope.$evalAsync(update);
                else update();
              }
            });
          }
          $scope.webEndpointRunning = true;
        } else if ($scope.webEndpointRunning) {
          if (bngApi && typeof bngApi.engineLua === 'function') {
            bngApi.engineLua('extensions.okWebServer.stop()');
          }
          $scope.webEndpointRunning = false;
        }
        $scope.settingsOpen = false;
      };

      function saveRowOrder() {
        var tbody = document.getElementById('dataRows');
        if (!tbody) return;
        var order = Array.prototype.map.call(tbody.children, function (r) { return r.id; });
        try { localStorage.setItem(ROW_ORDER_KEY, JSON.stringify(order)); } catch (e) {}
        sendWebData();
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
      var lastTrip_m = 0;
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

      // helper to update trip-related scope values from persisted totals
      function applyTripTotals(mode) {
          var liquidMode = mode === 'imperial' ? 'imperial' : 'metric';
          var avgMode = mode === 'food' ? 'metric' : mode;
          var totalTripFuel = (overall.fuelUsedLiquid || 0) + (overall.fuelUsedElectric || 0);
          var totalTripDistance = overall.distance || 0;
          var tripAvg =
              avgConsumptionAlgorithm === 'direct'
                  ? calculateAverageConsumption(totalTripFuel, totalTripDistance)
                  : overall.queue && overall.queue.length > 0
                  ? calculateMedian(overall.queue)
                  : 0;
          var tripAvgCo2 =
              totalTripDistance > 0
                  ? (overall.tripCo2 || 0) / (totalTripDistance / 1000)
                  : 0;
          $scope.tripAvgL100km = formatConsumptionRate(tripAvg, avgMode, 1);
          $scope.tripAvgKmL = formatEfficiency(
              tripAvg > 0 ? 100 / tripAvg : Infinity,
              avgMode,
              2
          );
          $scope.tripAvgCO2 = formatCO2(tripAvgCo2, 0, avgMode);
          $scope.tripCo2Class = classifyCO2(tripAvgCo2);
          $scope.tripAvgHistory =
              overall.queue && overall.queue.length > 0
                  ? buildQueueGraphPoints(overall.queue, 100, 40)
                  : '';
          $scope.tripAvgKmLHistory =
              overall.queue && overall.queue.length > 0
                  ? buildQueueGraphPoints(
                      overall.queue.map(function (v) {
                          return v > 0 ? Math.min(100 / v, MAX_EFFICIENCY) : MAX_EFFICIENCY;
                      }),
                      100,
                      40
                  )
                  : '';
          var unitLabels = getUnitLabels(mode);
          var distLiquidUnit = convertDistanceToUnit(tripDistanceLiquid_m, mode);
          var distElectricUnit = convertDistanceToUnit(tripDistanceElectric_m, mode);
          var tripAvgCostLiquidVal =
              distLiquidUnit > 0 ? tripCostLiquid / distLiquidUnit : 0;
          var tripAvgCostElectricVal =
              distElectricUnit > 0 ? tripCostElectric / distElectricUnit : 0;
          $scope.tripFuelUsedLiquid = tripFuelUsedLiquid_l > 0
              ? formatVolume(tripFuelUsedLiquid_l, liquidMode, 2)
              : '';
          $scope.tripFuelUsedElectric = tripFuelUsedElectric_l > 0
              ? formatVolume(tripFuelUsedElectric_l, 'electric', 2)
              : '';
          $scope.tripAvgCostLiquid = distLiquidUnit > 0
              ? tripAvgCostLiquidVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance
              : '';
          $scope.tripAvgCostElectric = distElectricUnit > 0
              ? tripAvgCostElectricVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance
              : '';
          $scope.tripTotalCostLiquid = tripCostLiquid > 0
              ? tripCostLiquid.toFixed(2) + ' ' + $scope.currency
              : '';
          $scope.tripTotalCostElectric = tripCostElectric > 0
              ? tripCostElectric.toFixed(2) + ' ' + $scope.currency
              : '';
          $scope.tripTotalCO2 = tripCo2_g > 0 ? formatMass(tripCo2_g) : '';
          $scope.tripTotalNOx = tripNox_g > 0 ? formatMass(tripNox_g) : '';
          $scope.data8 = formatDistance(overall.distance || 0, avgMode, 1);
      }

      // initialise scope with persisted trip values so they survive game restarts
      applyTripTotals($scope.unitMode);
      refreshCostOutputs();

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
          var distLiquidUnit = convertDistanceToUnit(tripDistanceLiquid_m, mode);
          var distElectricUnit = convertDistanceToUnit(tripDistanceElectric_m, mode);
          var tripAvgCostLiquidVal =
            distLiquidUnit > 0 ? tripCostLiquid / distLiquidUnit : 0;
          var tripAvgCostElectricVal =
            distElectricUnit > 0 ? tripCostElectric / distElectricUnit : 0;
          $scope.tripAvgCostLiquid =
            distLiquidUnit > 0
              ? tripAvgCostLiquidVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance
              : '';
          $scope.tripAvgCostElectric =
            distElectricUnit > 0
              ? tripAvgCostElectricVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance
              : '';
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
        lastTrip_m = 0;
        startFuel_l = null;
        previousFuel_l = null;
        lastCapacity_l = null;
        lastFuelFlow_lps = 0;
        idleFuelFlow_lps = 0;
        idleRpm = 0;
        lastThrottle = 0;
        var resetMode = getActiveUnitMode();
        $scope.avgL100km = formatConsumptionRate(0, resetMode, 1);
        $scope.avgKmL = formatEfficiency(0, resetMode, 2);
        resetInstantHistory();
        resetAvgHistory();
        if (!preserveTripFuel) {
          overall.previousAvg = 0;
          overall.previousAvgTrip = 0;
          tripFuelUsedLiquid_l = 0;
          tripFuelUsedElectric_l = 0;
          tripCostLiquid = 0;
          tripCostElectric = 0;
          tripDistanceLiquid_m = 0;
          tripDistanceElectric_m = 0;
          overall.queue = [];
          overall.co2Queue = [];
          overall.distance = 0;
          overall.fuelUsedLiquid = 0;
          overall.fuelUsedElectric = 0;
          overall.tripCostLiquid = 0;
          overall.tripCostElectric = 0;
          overall.tripDistanceLiquid = 0;
          overall.tripDistanceElectric = 0;
          $scope.tripFuelUsedLiquid = '';
          $scope.tripFuelUsedElectric = '';
          $scope.tripTotalCostLiquid = '';
          $scope.tripTotalCostElectric = '';
        }
        saveOverall();
        lastTime_ms = performance.now();
        $scope.vehicleNameStr = "";
        engineWasRunning = false;
        speedAvg = { queue: [] };
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
        applyTripTotals(mode);
        refreshCostOutputs();
      }

      function resetVehicleOutputs(mode) {
        hardReset(true);
        var labels = getUnitLabels(mode);
        $scope.data1 = formatDistance(0, mode, 1);
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
        applyTripTotals(mode);
        refreshCostOutputs();
      }

      $scope.reset = function () {
        $log.debug('<ok-fuel-economy> manual reset');
        hardReset(true);
        applyTripTotals(getActiveUnitMode());
        refreshCostOutputs();
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
        resetVehicleOutputs(getActiveUnitMode());
        manualUnit = false;
        lastFuelType = '';
        $scope.fuelType = 'None';
        fetchFuelType();
      });

      function sendWebData() {
        if ($scope.webEndpointRunning && bngApi && typeof bngApi.engineLua === 'function') {
          var rowOrder;
          try { rowOrder = JSON.parse(localStorage.getItem(ROW_ORDER_KEY)); } catch (e) { rowOrder = null; }
          var payload = {
            distanceMeasured: extractValueUnit($scope.data1),
            distanceEcu: extractValueUnit($scope.data6),
            fuelUsed: extractValueUnit($scope.fuelUsed),
            fuelLeft: extractValueUnit($scope.fuelLeft),
            fuelCap: extractValueUnit($scope.fuelCap),
            avgL100km: extractValueUnit($scope.avgL100km),
            avgKmL: extractValueUnit($scope.avgKmL),
            range: extractValueUnit($scope.data4),
            instantLph: extractValueUnit($scope.instantLph),
            instantL100km: extractValueUnit($scope.instantL100km),
            instantKmL: extractValueUnit($scope.instantKmL),
            instantCO2: extractValueUnit($scope.instantCO2),
            tripAvgL100km: extractValueUnit($scope.tripAvgL100km),
            tripAvgKmL: extractValueUnit($scope.tripAvgKmL),
            avgCO2: extractValueUnit($scope.avgCO2),
            avgCo2Class: $scope.avgCo2Class,
            tripAvgCO2: extractValueUnit($scope.tripAvgCO2),
            tripCo2Class: $scope.tripCo2Class,
            costPrice: extractValueUnit($scope.costPrice),
            avgCost: extractValueUnit($scope.avgCost),
            totalCost: extractValueUnit($scope.totalCost),
            tripAvgCostLiquid: extractValueUnit($scope.tripAvgCostLiquid),
            tripAvgCostElectric: extractValueUnit($scope.tripAvgCostElectric),
            tripTotalCostLiquid: extractValueUnit($scope.tripTotalCostLiquid),
            tripTotalCostElectric: extractValueUnit($scope.tripTotalCostElectric),
            tripFuelUsedLiquid: extractValueUnit($scope.tripFuelUsedLiquid),
            tripFuelUsedElectric: extractValueUnit($scope.tripFuelUsedElectric),
            tripTotalCO2: extractValueUnit($scope.tripTotalCO2),
            tripTotalNOx: extractValueUnit($scope.tripTotalNOx),
            tripDistance: extractValueUnit($scope.data8),
            tripRange: extractValueUnit($scope.data9),
            vehicleName: $scope.vehicleNameStr,
            fuelType: $scope.fuelType,
            gameStatus: $scope.gamePaused ? 'paused' : 'running',
            gameIsPaused: $scope.gamePaused ? 1 : 0,
            settings: {
              visible: $scope.visible,
              rowOrder: rowOrder,
              useCustomStyles: $scope.useCustomStyles,
              unitMode: $scope.unitMode
            }
          };
          bngApi.engineLua('extensions.okWebServer.setData(' + JSON.stringify(JSON.stringify(payload)) + ')');
        }
      }

      $scope.$on('streamsUpdate', function (event, streams) {
        $scope.$evalAsync(function () {
          if (streams.okGameState && typeof streams.okGameState.paused !== 'undefined') {
            $scope.gamePaused = !!streams.okGameState.paused;
          }
          if ($scope.gamePaused) {
            lastTime_ms = performance.now();
            sendWebData();
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
            sendWebData();
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
          if (trip_m < lastTrip_m) {
            // Vehicle reset – clear per-run accumulators but keep trip stats.
            resetVehicleOutputs(getActiveUnitMode());
          }
          lastTrip_m = trip_m;

          var currentFuel_l = streams.engineInfo[11];
          var capacity_l = streams.engineInfo[12];
          var throttle = streams.electrics.throttle_input || 0;
          var engineTemp_c = streams.engineInfo[13] || 0;
          var n2oActive = !!(streams.electrics && streams.electrics.n2oActive);
          var engineRunning = isEngineRunning(streams.electrics, streams.engineInfo);
          var rpmTacho = normalizeRpm(
            streams.electrics.rpmTacho || 0,
            engineRunning
          );
          if (!engineRunning && engineWasRunning) {
            resetVehicleOutputs(getActiveUnitMode());
          }
          engineWasRunning = engineRunning;
          if (!engineRunning && rpmTacho < MIN_RPM_RUNNING) {
            resetVehicleOutputs(getActiveUnitMode());
            idleFuelFlow_lps = 0;
            idleRpm = 0;
            lastFuelFlow_lps = 0;
            startFuel_l = currentFuel_l;
            previousFuel_l = currentFuel_l;
            return;
          }

          if (!Number.isFinite(currentFuel_l) || !Number.isFinite(capacity_l)) return;

          if (lastCapacity_l !== null && capacity_l !== lastCapacity_l) {
            $log.debug('<ok-fuel-economy> capacity changed -> reset trip');
            resetVehicleOutputs(getActiveUnitMode());
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
            // Fuel level jumped (vehicle reset or refuel). Preserve trip totals
            // and only reset the per-run accumulators.
            resetVehicleOutputs(getActiveUnitMode());
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
          rpmTacho = normalizeRpm(
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
            ($scope.unitMode === 'electric' || fuelFlow_lps >= 0);
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
            ? calculateInstantConsumption(
                fuelFlow_lps,
                speed_mps,
                $scope.unitMode === 'electric'
              )
            : 0;
          var eff =
            Number.isFinite(inst_l_per_100km) && inst_l_per_100km > 0
              ? 100 / inst_l_per_100km
              : Math.abs(speed_mps) <= EPS_SPEED
              ? 0
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

          var avg_l_per_100km_ok;
          if (avgConsumptionAlgorithm === 'direct') {
            avg_l_per_100km_ok = calculateAverageConsumption(
              fuel_used_l,
              distance_m
            );
          } else {
            avg_l_per_100km_ok = resolveAverageConsumption(
              sampleValid,
              inst_l_per_100km,
              avgRecent,
              AVG_MAX_ENTRIES,
              $scope.unitMode === 'electric'
            );
          }
          var avgMax =
            $scope.unitMode === 'electric'
              ? MAX_ELECTRIC_CONSUMPTION
              : MAX_CONSUMPTION;
          if (!Number.isFinite(avg_l_per_100km_ok)) {
            avg_l_per_100km_ok = 0;
          } else if (avg_l_per_100km_ok > avgMax) {
            avg_l_per_100km_ok =
              avgConsumptionAlgorithm === 'direct' ? avgMax : 0;
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
            var totalTripFuelNow =
              (overall.fuelUsedLiquid || 0) + (overall.fuelUsedElectric || 0);
            var totalTripDistanceNow = overall.distance || 0;
            overall.previousAvgTrip =
              avgConsumptionAlgorithm === 'direct'
                ? calculateAverageConsumption(
                    totalTripFuelNow,
                    totalTripDistanceNow
                  )
                : avg_l_per_100km_ok;

            if (!overall.lastSaveTime) overall.lastSaveTime = 0;
            var now = performance.now();
            if (now - overall.lastSaveTime >= 100) {
              saveOverall();
              overall.lastSaveTime = now;
            }
          }

          var totalTripFuel =
            (overall.fuelUsedLiquid || 0) + (overall.fuelUsedElectric || 0);
          var totalTripDistance = overall.distance || 0;

          // Use the median of the recorded averages for trip stats and graphs
          var overall_median =
            avgConsumptionAlgorithm === 'direct'
              ? calculateAverageConsumption(totalTripFuel, totalTripDistance)
              : calculateMedian(overall.queue);
          var tripAvgCo2Val =
            totalTripDistance > 0
              ? (overall.tripCo2 || 0) / (totalTripDistance / 1000)
              : 0;
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

          var distLiquidUnit = convertDistanceToUnit(tripDistanceLiquid_m, mode);
          var distElectricUnit = convertDistanceToUnit(tripDistanceElectric_m, mode);
          var tripAvgCostLiquidVal =
            distLiquidUnit > 0 ? tripCostLiquid / distLiquidUnit : 0;
          var tripAvgCostElectricVal =
            distElectricUnit > 0 ? tripCostElectric / distElectricUnit : 0;
          $scope.tripAvgCostLiquid =
            distLiquidUnit > 0
              ? tripAvgCostLiquidVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance
              : '';
          $scope.tripAvgCostElectric =
            distElectricUnit > 0
              ? tripAvgCostElectricVal.toFixed(2) + ' ' + $scope.currency + '/' + unitLabels.distance
              : '';
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

          sendWebData();

          lastDistance_m = distance_m;
          initialized = true;
        });
      });
    }]
  };
}]);
