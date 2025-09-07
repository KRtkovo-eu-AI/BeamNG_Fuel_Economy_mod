const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function setup(options = {}) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bng-'));
  const versionDir = path.join(tmpRoot, '0.0');
  fs.mkdirSync(path.join(versionDir, 'settings', 'krtektm_fuelEconomy'), { recursive: true });
  const prevDir = process.env.KRTEKTM_BNG_USER_DIR;
  process.env.KRTEKTM_BNG_USER_DIR = tmpRoot;

  let directiveDef;
  global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
  global.StreamsManager = { add: () => {}, remove: () => {} };
  global.UiUnits = { buildString: (t, v, p) => (v && v.toFixed ? v.toFixed(p) : String(v)) };
  global.window = {};

  const engineLuaCalls = [];
  const activeObjectLuaCalls = [];
  global.bngApi = {
    engineLua: (lua, cb) => { engineLuaCalls.push(lua); if (cb) cb(''); },
    activeObjectLua: (lua, cb) => {
      activeObjectLuaCalls.push(lua);
      const res = JSON.stringify({ t: options.fuelType || 'Electric' });
      if (cb) cb(res);
    }
  };

  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; }
  };

  let now = 0;
  global.performance = { now: () => { now += 100; return now; } };

  const appPath = path.join(__dirname, '..', '..', 'okFuelEconomy', 'ui', 'modules', 'apps', 'okFuelEconomy', 'app.js');
  delete require.cache[require.resolve(appPath)];
  require(appPath);
  const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];

  const asyncQueue = [];
  const $scope = { $on: (name, cb) => { $scope['on_' + name] = cb; }, $evalAsync: fn => { asyncQueue.push(fn); } };
  controllerFn({ debug: () => {} }, $scope);
  while (asyncQueue.length) {
    asyncQueue.shift()();
  }

  function cleanup() {
    delete global.angular;
    delete global.StreamsManager;
    delete global.UiUnits;
    delete global.window;
    delete global.bngApi;
    delete global.localStorage;
    delete global.performance;
    if (prevDir === undefined) delete process.env.KRTEKTM_BNG_USER_DIR; else process.env.KRTEKTM_BNG_USER_DIR = prevDir;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  }

  return { $scope, engineLuaCalls, activeObjectLuaCalls, cleanup };
}

module.exports = { setup };
