const assert = require('node:assert');
const { describe, it } = require('node:test');

function setupControllerEnvironment(savedOrder, defaultOrder) {
  const savedGlobals = {};
  ['angular', 'StreamsManager', 'UiUnits', 'window', 'bngApi', 'localStorage', 'performance', 'document', 'MutationObserver']
    .forEach(key => {
      savedGlobals[key] = Object.prototype.hasOwnProperty.call(global, key)
        ? global[key]
        : undefined;
    });

  let directiveDef;
  global.angular = { module: () => ({ directive: (name, arr) => { directiveDef = arr[0](); } }) };
  global.StreamsManager = { add: () => {}, remove: () => {} };
  global.UiUnits = { buildString: () => '' };
  global.window = {};
  const luaCalls = [];
  global.bngApi = { engineLua: cmd => luaCalls.push(cmd) };
  global.performance = { now: (() => { let t = 0; return () => { t += 16; return t; }; })() };

  function createParent() {
    const children = [];
    return {
      children,
      appendChild(node) {
        const idx = children.indexOf(node);
        if (idx !== -1) children.splice(idx, 1);
        children.push(node);
        node.parentElement = this;
      }
    };
  }

  function createRow(id) {
    return { id, parentElement: null };
  }

  function createSetting(id) {
    return {
      getAttribute(name) { return name === 'data-row' ? id : null; },
      parentElement: null
    };
  }

  const domMap = {};
  const dataRows = createParent();
  const settingsList = createParent();
  domMap.dataRows = dataRows;
  domMap.settingsList = settingsList;
  domMap.heading = { style: {}, textContent: '' };
  const settingMap = {};

  defaultOrder.forEach(id => {
    const row = createRow(id);
    domMap[id] = row;
    dataRows.appendChild(row);
    const setting = createSetting(id);
    setting.parentElement = settingsList;
    settingMap[id] = setting;
    settingsList.appendChild(setting);
  });

  global.document = {
    body: {},
    getElementById(id) {
      return Object.prototype.hasOwnProperty.call(domMap, id) ? domMap[id] : null;
    }
  };

  const storage = new Map();
  if (savedOrder) storage.set('okFeRowOrder', JSON.stringify(savedOrder));
  const storedOrders = [];
  global.localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, value);
      if (key === 'okFeRowOrder') storedOrders.push(JSON.parse(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };

  global.MutationObserver = function (callback) {
    this.callback = callback;
    setupControllerEnvironment.lastObserver = this;
  };
  global.MutationObserver.prototype.observe = function () {};
  global.MutationObserver.prototype.disconnect = function () {};

  delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
  require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
  const controllerFn = directiveDef.controller[directiveDef.controller.length - 1];
  const $scope = { $on: () => {} };
  controllerFn({ debug: () => {} }, $scope);

  function cleanup() {
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    Object.keys(savedGlobals).forEach(key => {
      if (savedGlobals[key] === undefined) {
        delete global[key];
      } else {
        global[key] = savedGlobals[key];
      }
    });
    setupControllerEnvironment.lastObserver = null;
  }

  function removeRow(id) {
    const row = domMap[id];
    if (!row) return;
    const idx = dataRows.children.indexOf(row);
    if (idx !== -1) dataRows.children.splice(idx, 1);
    row.parentElement = null;
    delete domMap[id];
  }

  function addRowAtStart(id) {
    const row = createRow(id);
    row.parentElement = dataRows;
    dataRows.children.unshift(row);
    domMap[id] = row;
    return row;
  }

  return {
    $scope,
    dataRows,
    settingsList,
    settingMap,
    storedOrders,
    getRowIds: () => dataRows.children.map(node => node.id),
    getSettingIds: () => settingsList.children.map(item => item.getAttribute('data-row')),
    removeRow,
    addRowAtStart,
    triggerObserver: () => {
      if (setupControllerEnvironment.lastObserver && setupControllerEnvironment.lastObserver.callback) {
        setupControllerEnvironment.lastObserver.callback([]);
      }
    },
    cleanup,
    getSettingItem: id => settingMap[id]
  };
}

describe('settings row order management', () => {
  it('applies saved row order to both data rows and settings list', () => {
    const defaultOrder = ['row-distance', 'row-fuel', 'row-range'];
    const savedOrder = ['row-range', 'row-distance', 'row-fuel'];
    const env = setupControllerEnvironment(savedOrder, defaultOrder);
    try {
      assert.deepStrictEqual(env.getRowIds(), savedOrder);
      assert.deepStrictEqual(env.getSettingIds(), savedOrder);
    } finally {
      env.cleanup();
    }
  });

  it('allows reordering entries even when the data row is absent', () => {
    const defaultOrder = ['row-distance', 'row-fuel', 'row-range'];
    const env = setupControllerEnvironment(defaultOrder, defaultOrder);
    try {
      env.removeRow('row-fuel');
      const target = { closest: () => env.getSettingItem('row-fuel') };
      env.$scope.moveRow({ target }, 1);
      assert.deepStrictEqual(env.getSettingIds(), ['row-distance', 'row-range', 'row-fuel']);
      assert.ok(env.storedOrders.some(order => order.join(',') === 'row-distance,row-range,row-fuel'));
    } finally {
      env.cleanup();
    }
  });

  it('restores the configured order when rows reappear', () => {
    const defaultOrder = ['row-distance', 'row-fuel', 'row-range'];
    const savedOrder = ['row-range', 'row-distance', 'row-fuel'];
    const env = setupControllerEnvironment(savedOrder, defaultOrder);
    try {
      env.removeRow('row-range');
      env.addRowAtStart('row-range');
      env.triggerObserver();
      assert.deepStrictEqual(env.getRowIds(), savedOrder);
    } finally {
      env.cleanup();
    }
  });
});
