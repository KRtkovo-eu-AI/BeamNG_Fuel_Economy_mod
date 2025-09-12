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
      let data = {};
      try { data = JSON.parse(fs.readFileSync(userFile, 'utf8')); } catch (e) {}
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
      const changed = JSON.stringify(cfgObj) !== JSON.stringify(data);
      if (changed) fs.writeFileSync(userFile, JSON.stringify(cfgObj, null, 2));
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
        'local cfg=jsonReadFile(p) or {}',
        'local changed=false',
        "if cfg.prices==nil then cfg.prices={Gasoline=0,Electricity=0}; changed=true end",
        "if cfg.liquidFuelPrice~=nil then cfg.prices.Gasoline=cfg.liquidFuelPrice; cfg.liquidFuelPrice=nil; changed=true end",
        "if cfg.electricityPrice~=nil then cfg.prices.Electricity=cfg.electricityPrice; cfg.electricityPrice=nil; changed=true end",
        "if cfg.prices.Gasoline==nil then cfg.prices.Gasoline=0; changed=true end",
        "if cfg.prices.Electricity==nil then cfg.prices.Electricity=0; changed=true end",
        "if cfg.currency==nil then cfg.currency='money'; changed=true end",
        'if changed then jsonWriteFile(p,cfg) end',
        "return jsonEncode({prices=cfg.prices,currency=cfg.currency})",
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

function loadAvgConsumptionAlgorithm(callback) {
  var algo = 'optimized';
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
      if (latest) {
        const settingsDir = path.join(
          baseDir,
          latest,
          'settings',
          'krtektm_fuelEconomy'
        );
        fs.mkdirSync(settingsDir, { recursive: true });
        const userFile = path.join(settingsDir, 'settings.json');
        let data = {};
        if (fs.existsSync(userFile)) {
          try { data = JSON.parse(fs.readFileSync(userFile, 'utf8')); } catch (e) {}
        }
        if (data.AvgConsumptionAlgorithm !== 'direct' && data.AvgConsumptionAlgorithm !== 'optimized') {
          data.AvgConsumptionAlgorithm = 'optimized';
          fs.writeFileSync(userFile, JSON.stringify(data, null, 2));
        }
        algo = data.AvgConsumptionAlgorithm;
      }
    } catch (e) { /* ignore */ }
    if (typeof callback === 'function') callback(algo);
    return algo;
  }
  if (typeof bngApi !== 'undefined' && typeof bngApi.engineLua === 'function') {
    try {
      var lua = [
        '(function()',
        "local user=(core_paths and core_paths.getUserPath and core_paths.getUserPath()) or ''",
        "local dir=user..'settings/krtektm_fuelEconomy/'",
        'FS:directoryCreate(dir)',
        "local p=dir..'settings.json'",
        'local cfg=jsonReadFile(p) or {}',
        "if cfg.AvgConsumptionAlgorithm==nil then cfg.AvgConsumptionAlgorithm='optimized'; jsonWriteFile(p,cfg,true) end",
        "return cfg.AvgConsumptionAlgorithm or 'optimized'",
        'end)()'
      ].join('\n');
      bngApi.engineLua(lua, function (res) {
        var val = res === 'direct' ? 'direct' : 'optimized';
        if (typeof callback === 'function') callback(val);
      });
    } catch (e) {
      if (typeof callback === 'function') callback(algo);
    }
    return algo;
  }
  if (typeof callback === 'function') callback(algo);
  return algo;
}

function saveAvgConsumptionAlgorithm(algo) {
  algo = algo === 'direct' ? 'direct' : 'optimized';
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
      if (latest) {
        const settingsDir = path.join(
          baseDir,
          latest,
          'settings',
          'krtektm_fuelEconomy'
        );
        fs.mkdirSync(settingsDir, { recursive: true });
        const userFile = path.join(settingsDir, 'settings.json');
        let data = {};
        if (fs.existsSync(userFile)) {
          try { data = JSON.parse(fs.readFileSync(userFile, 'utf8')); } catch (e) {}
        }
        if (data.AvgConsumptionAlgorithm !== algo) {
          data.AvgConsumptionAlgorithm = algo;
          fs.writeFileSync(userFile, JSON.stringify(data, null, 2));
        }
      }
    } catch (e) { /* ignore */ }
    return algo;
  }
  if (typeof bngApi !== 'undefined' && typeof bngApi.engineLua === 'function') {
    try {
      var lua = [
        '(function()',
        "local user=(core_paths and core_paths.getUserPath and core_paths.getUserPath()) or ''",
        "local dir=user..'settings/krtektm_fuelEconomy/'",
        'FS:directoryCreate(dir)',
        "local p=dir..'settings.json'",
        'local cfg=jsonReadFile(p) or {}',
        "cfg.AvgConsumptionAlgorithm='" + (algo === 'direct' ? 'direct' : 'optimized') + "'",
        'jsonWriteFile(p,cfg,true)',
        'end)()'
      ].join('\n');
      bngApi.engineLua(lua);
    } catch (e) { /* ignore */ }
  }
  return algo;
}

module.exports = {
  loadFuelPriceConfig,
  loadAvgConsumptionAlgorithm,
  saveAvgConsumptionAlgorithm
};
