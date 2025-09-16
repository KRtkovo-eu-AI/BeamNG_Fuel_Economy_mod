const assert = require('node:assert');
const { describe, it } = require('node:test');

function setupControllerEnvironment(savedOrder, defaultOrder, options) {
  const opts = options || {};
  const anchorSet = new Set(opts.ngIfAnchors || []);
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

  function updateRelationships(parent) {
    parent.children = [];
    for (let i = 0; i < parent.childNodes.length; i += 1) {
      const node = parent.childNodes[i];
      node.parentElement = parent;
      node.previousSibling = i > 0 ? parent.childNodes[i - 1] : null;
      node.nextSibling = i < parent.childNodes.length - 1 ? parent.childNodes[i + 1] : null;
      if (node.nodeType === 1) parent.children.push(node);
    }
  }

  function createParent() {
    const parent = {
      childNodes: [],
      children: [],
      mutationCount: 0,
      appendChild(node) {
        if (!node) return node;
        if (node.parentElement) {
          if (node.parentElement === this) {
            const idx = this.childNodes.indexOf(node);
            if (idx !== -1) this.childNodes.splice(idx, 1);
          } else if (typeof node.parentElement.removeChild === 'function') {
            node.parentElement.removeChild(node);
          }
        }
        this.childNodes.push(node);
        updateRelationships(this);
        parent.mutationCount += 1;
        return node;
      },
      removeChild(node) {
        const idx = this.childNodes.indexOf(node);
        if (idx !== -1) {
          this.childNodes.splice(idx, 1);
          updateRelationships(this);
          parent.mutationCount += 1;
        }
        if (node) {
          node.parentElement = null;
          node.previousSibling = null;
          node.nextSibling = null;
        }
        return node;
      }
    };
    return parent;
  }

  function createRow(id) {
    return {
      id,
      nodeType: 1,
      parentElement: null,
      previousSibling: null,
      nextSibling: null
    };
  }

  function createComment(label, anchorId, role) {
    return {
      nodeType: 8,
      textContent: label || '',
      anchorId: anchorId || null,
      anchorRole: role || null,
      parentElement: null,
      previousSibling: null,
      nextSibling: null
    };
  }

  function createSetting(id) {
    return {
      nodeType: 1,
      getAttribute(name) { return name === 'data-row' ? id : null; },
      parentElement: null,
      previousSibling: null,
      nextSibling: null
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
    if (anchorSet.has(id)) {
      const startComment = createComment(`ngIf start for ${id}`, id, 'start');
      dataRows.appendChild(startComment);
    }
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
    const parent = row.parentElement;
    if (parent && Array.isArray(parent.childNodes)) {
      const nodes = parent.childNodes;
      const rowIndex = nodes.indexOf(row);
      if (rowIndex !== -1) {
        let hasStart = false;
        let hasEnd = false;
        let startIndex = rowIndex;
        for (let i = rowIndex - 1; i >= 0; i -= 1) {
          const candidate = nodes[i];
          if (candidate.nodeType === 8 && candidate.anchorId === id && candidate.anchorRole === 'start') {
            hasStart = true;
            startIndex = i;
            break;
          }
        }
        let endIndex = rowIndex;
        for (let i = rowIndex + 1; i < nodes.length; i += 1) {
          const candidate = nodes[i];
          if (candidate.nodeType === 8 && candidate.anchorId === id && candidate.anchorRole === 'end') {
            hasEnd = true;
            endIndex = i;
            break;
          }
        }
        const sliceStart = hasStart ? startIndex : rowIndex;
        const sliceEnd = hasEnd ? endIndex + 1 : rowIndex + 1;
        const toRemove = nodes.slice(sliceStart, sliceEnd);
        toRemove.forEach(node => parent.removeChild(node));
      } else if (typeof parent.removeChild === 'function') {
        parent.removeChild(row);
      }
    } else if (row.parentElement && typeof row.parentElement.removeChild === 'function') {
      row.parentElement.removeChild(row);
    }
    row.parentElement = null;
    delete domMap[id];
  }

  function addRowAtStart(id) {
    const row = createRow(id);
    domMap[id] = row;
    dataRows.childNodes.unshift(row);
    updateRelationships(dataRows);
    dataRows.mutationCount += 1;
    return row;
  }

  return {
    $scope,
    dataRows,
    settingsList,
    settingMap,
    storedOrders,
    getDataRowMutations: () => dataRows.mutationCount,
    getRowIds: () => dataRows.children.map(node => node.id),
    getRowNodeSummary: () =>
      dataRows.childNodes.map(node =>
        node.nodeType === 1 ? node.id : `#comment:${node.textContent}`),
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

  it('avoids redundant reordering when the DOM already matches the desired order', () => {
    const defaultOrder = ['row-distance', 'row-fuel', 'row-range'];
    const env = setupControllerEnvironment(null, defaultOrder);
    try {
      env.removeRow('row-fuel');
      env.triggerObserver();
      const firstMutations = env.getDataRowMutations();
      assert.ok(firstMutations > 0);
      env.triggerObserver();
      assert.strictEqual(env.getDataRowMutations(), firstMutations);
    } finally {
      env.cleanup();
    }
  });

  it('only hides the targeted instant efficiency history row', () => {
    const defaultOrder = [
      'row-instantGraph',
      'row-instantKmLGraph',
      'row-instantCO2',
      'row-avgL100km'
    ];
    const savedOrder = [
      'row-instantKmLGraph',
      'row-instantGraph',
      'row-instantCO2',
      'row-avgL100km'
    ];
    const env = setupControllerEnvironment(savedOrder, defaultOrder, {
      ngIfAnchors: ['row-instantKmLGraph']
    });
    try {
      const nodeSummary = env.getRowNodeSummary();
      const startIdx = nodeSummary.indexOf('#comment:ngIf start for row-instantKmLGraph');
      const rowIdx = nodeSummary.indexOf('row-instantKmLGraph');
      assert.ok(startIdx !== -1 && rowIdx !== -1);
      assert.strictEqual(rowIdx, startIdx + 1);

      env.removeRow('row-instantKmLGraph');
      env.triggerObserver();

      assert.deepStrictEqual(env.getRowIds(), [
        'row-instantGraph',
        'row-instantCO2',
        'row-avgL100km'
      ]);
    } finally {
      env.cleanup();
    }
  });
});
