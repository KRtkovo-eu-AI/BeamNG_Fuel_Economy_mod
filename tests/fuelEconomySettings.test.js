const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Fuel Economy Settings saving', () => {
  it('persists order and visibility', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reorder-'));
    const map = p => path.join(tmp, p.replace(/^\//, ''));

    const configPath = '/settings/krtektm_fuelEconomy/settings.json';
    const configDir = '/settings/krtektm_fuelEconomy/';

    const defaultOrder = ['a', 'b', 'c'];

    const data = { order: [], visible: {} };
    const uiState = { order: [], visible: {} };

    const FS = {
      directoryExists: p => fs.existsSync(map(p)),
      directoryCreate: p => fs.mkdirSync(map(p), { recursive: true }),
      fileExists: p => fs.existsSync(map(p))
    };

    const jsonWriteFile = (p, obj) => fs.writeFileSync(map(p), JSON.stringify(obj));
    const jsonReadFile = p => JSON.parse(fs.readFileSync(map(p), 'utf8'));

    function ensureFile() {
      if (!FS.directoryExists(configDir)) FS.directoryCreate(configDir);
      if (!FS.fileExists(configPath)) {
        const visible = {};
        defaultOrder.forEach(k => (visible[k] = true));
        jsonWriteFile(configPath, { order: defaultOrder, visible });
      }
    }

    function loadConfig() {
      const cfg = jsonReadFile(configPath);
      data.order = cfg.order || [];
      data.visible = cfg.visible || {};
      uiState.order = [];
      uiState.visible = {};
      (data.order.length ? data.order : defaultOrder).forEach(k => {
        uiState.order.push(k);
        uiState.visible[k] = { 0: data.visible[k] !== false };
      });
      defaultOrder.forEach(k => {
        if (!(k in uiState.visible)) {
          uiState.order.push(k);
          uiState.visible[k] = { 0: true };
        }
      });
    }

    function saveConfig() {
      data.order = uiState.order;
      data.visible = {};
      Object.keys(uiState.visible).forEach(k => {
        data.visible[k] = uiState.visible[k][0];
      });
      jsonWriteFile(configPath, data);
      loadConfig();
    }

    ensureFile();
    loadConfig();
    uiState.order = ['c', 'b', 'a'];
    uiState.visible.a[0] = false;
    saveConfig();

    const saved = jsonReadFile(configPath);
    assert.deepStrictEqual(saved, { order: ['c', 'b', 'a'], visible: { a: false, b: true, c: true } });
  });
});

