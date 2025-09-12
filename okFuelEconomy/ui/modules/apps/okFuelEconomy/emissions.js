const {
  MAX_CONSUMPTION,
  MAX_ELECTRIC_CONSUMPTION,
  EMISSIONS_BASE_TEMP_C
} = require('./constants');
const { KM_PER_MILE } = require('./format');

const DEFAULT_CO2_FACTORS_G_PER_L = {
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

const DEFAULT_NOX_FACTORS_G_PER_L = {
  Gasoline: 10,
  Diesel: 20,
  'LPG/CNG': 7,
  Electricity: 0,
  Air: 0,
  Ethanol: 3,
  Hydrogen: 1,
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

const DEFAULT_FUEL_EMISSIONS = Object.keys(DEFAULT_CO2_FACTORS_G_PER_L).reduce(
  function (acc, key) {
    acc[key] = {
      CO2: DEFAULT_CO2_FACTORS_G_PER_L[key],
      NOx:
        DEFAULT_NOX_FACTORS_G_PER_L[key] != null
          ? DEFAULT_NOX_FACTORS_G_PER_L[key]
          : 0
    };
    return acc;
  },
  {}
);

let CO2_FACTORS_G_PER_L = Object.assign({}, DEFAULT_CO2_FACTORS_G_PER_L);
let NOX_FACTORS_G_PER_L = Object.assign({}, DEFAULT_NOX_FACTORS_G_PER_L);

function calculateCO2Factor(fuelType, engineTempC, n2oActive, isElectric) {
  var base = CO2_FACTORS_G_PER_L[fuelType] != null
    ? CO2_FACTORS_G_PER_L[fuelType]
    : CO2_FACTORS_G_PER_L.Gasoline;
  if (base === 0) {
    return base;
  }
  if (!isElectric) {
    var temp =
      typeof engineTempC === 'number' ? engineTempC : EMISSIONS_BASE_TEMP_C;
    var delta = Math.abs(temp - EMISSIONS_BASE_TEMP_C);
    base = base * (1 + delta / 100);
    if (n2oActive) base *= 1.2;
  }
  return base;
}

function calculateCO2gPerKm(lPer100km, fuelType, engineTempC, n2oActive, isElectric) {
  var factor = calculateCO2Factor(fuelType, engineTempC, n2oActive, isElectric);
  if (!Number.isFinite(lPer100km)) return Infinity;
  var max = isElectric ? MAX_ELECTRIC_CONSUMPTION : MAX_CONSUMPTION;
  var capped = Math.min(lPer100km, max);
  return (capped / 100) * factor;
}

function calculateNOxFactor(fuelType, engineTempC, n2oActive, isElectric) {
  if (isElectric) return 0;
  var base = NOX_FACTORS_G_PER_L[fuelType] != null
    ? NOX_FACTORS_G_PER_L[fuelType]
    : NOX_FACTORS_G_PER_L.Gasoline;
  var temp = typeof engineTempC === 'number' ? engineTempC : 0;
  var tempExcess = Math.max(0, temp - EMISSIONS_BASE_TEMP_C);
  base = base * (1 + tempExcess / 100);
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

function loadFuelEmissionsConfig(callback) {
  var defaults = JSON.parse(JSON.stringify(DEFAULT_FUEL_EMISSIONS));

  function applyCfg(cfg) {
    CO2_FACTORS_G_PER_L = {};
    NOX_FACTORS_G_PER_L = {};
    Object.keys(cfg).forEach(function (k) {
      var vals = cfg[k] || {};
      CO2_FACTORS_G_PER_L[k] = typeof vals.CO2 === 'number' ? vals.CO2 : 0;
      NOX_FACTORS_G_PER_L[k] = typeof vals.NOx === 'number' ? vals.NOx : 0;
    });
  }

  if (typeof require === 'function' && typeof process !== 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
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
        applyCfg(defaults);
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
      const userFile = path.join(settingsDir, 'fuelEmissions.json');
      loadFuelEmissionsConfig.userFile = userFile;
      let data = {};
      if (fs.existsSync(userFile)) {
        try { data = JSON.parse(fs.readFileSync(userFile, 'utf8')); } catch (e) {}
      }
      const merged = JSON.parse(JSON.stringify(defaults));
      Object.keys(data).forEach(function (k) {
        if (!merged[k]) merged[k] = { CO2: 0, NOx: 0 };
        if (typeof data[k].CO2 === 'number') merged[k].CO2 = data[k].CO2;
        if (typeof data[k].NOx === 'number') merged[k].NOx = data[k].NOx;
      });
      const changed = JSON.stringify(merged) !== JSON.stringify(data);
      if (changed)
        fs.writeFileSync(userFile, JSON.stringify(merged, null, 2));
      applyCfg(merged);
      if (typeof callback === 'function') callback(merged);
      return merged;
    } catch (e) {
      applyCfg(defaults);
      if (typeof callback === 'function') callback(defaults);
      return defaults;
    }
  }

  if (typeof bngApi !== 'undefined' && typeof bngApi.engineLua === 'function') {
    try {
      var defaultsJson = JSON.stringify(DEFAULT_FUEL_EMISSIONS);
      var lua = [
        '(function()',
        "local user=(core_paths and core_paths.getUserPath and core_paths.getUserPath()) or ''",
        "local dir=user..'settings/krtektm_fuelEconomy/'",
        'FS:directoryCreate(dir)',
        "local p=dir..'fuelEmissions.json'",
        'local cfg=jsonReadFile(p) or {}',
        'local defaults=jsonDecode(' + JSON.stringify(defaultsJson) + ')',
        'local changed=false',
        'for fuel,vals in pairs(defaults) do',
        "  if type(cfg[fuel])~='table' then cfg[fuel]={CO2=vals.CO2,NOx=vals.NOx}; changed=true",
        '  else',
        '    if cfg[fuel].CO2==nil then cfg[fuel].CO2=vals.CO2; changed=true end',
        '    if cfg[fuel].NOx==nil then cfg[fuel].NOx=vals.NOx; changed=true end',
        '  end',
        'end',
        'if changed then jsonWriteFile(p,cfg) end',
        'return jsonEncode(cfg)',
        'end)()'
      ].join('\n');
      bngApi.engineLua(lua, function (res) {
        var cfg = defaults;
        try { cfg = JSON.parse(res); } catch (e) {}
        applyCfg(cfg);
        if (typeof callback === 'function') callback(cfg);
      });
    } catch (e) {
      applyCfg(defaults);
      if (typeof callback === 'function') callback(defaults);
    }
    return defaults;
  }

  applyCfg(defaults);
  if (typeof callback === 'function') callback(defaults);
  return defaults;
}

function ensureFuelEmissionType(name) {
  if (!name || name === 'None') return;
  if (CO2_FACTORS_G_PER_L[name] != null && NOX_FACTORS_G_PER_L[name] != null) return;
  if (CO2_FACTORS_G_PER_L[name] == null) CO2_FACTORS_G_PER_L[name] = 0;
  if (NOX_FACTORS_G_PER_L[name] == null) NOX_FACTORS_G_PER_L[name] = 0;
  if (typeof require === 'function' && loadFuelEmissionsConfig.userFile) {
    try {
      const fs = require('fs');
      const data = {};
      Object.keys(CO2_FACTORS_G_PER_L).forEach(function (k) {
        data[k] = {
          CO2: CO2_FACTORS_G_PER_L[k],
          NOx: NOX_FACTORS_G_PER_L[k]
        };
      });
      fs.writeFileSync(
        loadFuelEmissionsConfig.userFile,
        JSON.stringify(data, null, 2)
      );
    } catch (e) {}
  } else if (typeof bngApi !== 'undefined' && typeof bngApi.engineLua === 'function') {
    var lua = [
      "local user=(core_paths and core_paths.getUserPath and core_paths.getUserPath()) or ''",
      "local dir=user..'settings/krtektm_fuelEconomy/'",
      'FS:directoryCreate(dir)',
      "local p=dir..'fuelEmissions.json'",
      'local cfg=jsonReadFile(p) or {}',
      'cfg["' + name + '"]={CO2=' + CO2_FACTORS_G_PER_L[name] + ',NOx=' + NOX_FACTORS_G_PER_L[name] + '}',
      'jsonWriteFile(p,cfg,true)'
    ].join('\n');
    bngApi.engineLua(lua);
  }
}

module.exports = {
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
};
