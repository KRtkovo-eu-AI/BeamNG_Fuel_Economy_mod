const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Fuel Price Editor saving', () => {
  it('saves edited prices to fuelPrice.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fuel-'));
    const map = p => path.join(tmp, p.replace(/^\//, ''));

    const pricePath = '/settings/krtektm_fuelEconomy/fuelPrice.json';
    const priceDir = '/settings/krtektm_fuelEconomy/';

    const data = {};
    const uiState = {
      prices: { Gasoline: { 0: 0 }, Electricity: { 0: 0 } },
      currency: { value: 'money' }
    };

    const FS = {
      directoryExists: p => fs.existsSync(map(p)),
      directoryCreate: p => fs.mkdirSync(map(p), { recursive: true }),
      fileExists: p => fs.existsSync(map(p))
    };

    const jsonWriteFile = (p, tbl) => fs.writeFileSync(map(p), JSON.stringify(tbl));
    const jsonReadFile = p => JSON.parse(fs.readFileSync(map(p), 'utf8'));

    function ensureFile() {
      if (!FS.directoryExists(priceDir)) FS.directoryCreate(priceDir);
      if (!FS.fileExists(pricePath)) jsonWriteFile(pricePath, { prices: { Gasoline: 0, Electricity: 0 }, currency: 'money' });
    }

    function loadPrices() {
      const read = jsonReadFile(pricePath);
      Object.assign(data, read);
      uiState.prices = {};
      Object.keys(read.prices).forEach(k => {
        uiState.prices[k] = { 0: read.prices[k] };
      });
      uiState.currency.value = read.currency;
    }

    function savePrices() {
      data.prices = {};
      Object.keys(uiState.prices).forEach(k => {
        data.prices[k] = uiState.prices[k][0];
      });
      data.currency = uiState.currency.value;
      jsonWriteFile(pricePath, data);
      loadPrices();
    }

    ensureFile();
    loadPrices();
    uiState.prices.Gasoline[0] = 3.7;
    uiState.prices.Electricity[0] = 1.6;
    uiState.currency.value = 'EUR';
    savePrices();

    const saved = jsonReadFile(pricePath);
    assert.deepStrictEqual(saved, { prices: { Gasoline: 3.7, Electricity: 1.6 }, currency: 'EUR' });
  });

  it('migrates legacy fuelPrice.json format', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fuel-'));
    const map = p => path.join(tmp, p.replace(/^\//, ''));

    const pricePath = '/settings/krtektm_fuelEconomy/fuelPrice.json';
    fs.mkdirSync(path.dirname(map(pricePath)), { recursive: true });
    fs.writeFileSync(
      map(pricePath),
      JSON.stringify({ liquidFuelPrice: 4, electricityPrice: 1.2, currency: 'USD' })
    );

    const data = {};
    const uiState = { prices: {}, currency: { value: 'money' } };

    const jsonWriteFile = (p, tbl) => fs.writeFileSync(map(p), JSON.stringify(tbl));
    const jsonReadFile = p => JSON.parse(fs.readFileSync(map(p), 'utf8'));

    function migrate(cfg) {
      let migrated = false;
      cfg.prices = cfg.prices || {};
      if (cfg.prices.Gasoline === undefined && cfg.liquidFuelPrice !== undefined) {
        cfg.prices.Gasoline = cfg.liquidFuelPrice;
        delete cfg.liquidFuelPrice;
        migrated = true;
      }
      if (cfg.prices.Electricity === undefined && cfg.electricityPrice !== undefined) {
        cfg.prices.Electricity = cfg.electricityPrice;
        delete cfg.electricityPrice;
        migrated = true;
      }
      if (cfg.prices.Gasoline === undefined) {
        cfg.prices.Gasoline = 0;
        migrated = true;
      }
      if (cfg.prices.Electricity === undefined) {
        cfg.prices.Electricity = 0;
        migrated = true;
      }
      if (cfg.currency === undefined) {
        cfg.currency = 'money';
        migrated = true;
      }
      return { cfg, migrated };
    }

    function loadPrices() {
      let read = jsonReadFile(pricePath);
      const res = migrate(read);
      read = res.cfg;
      if (res.migrated) jsonWriteFile(pricePath, read);
      Object.assign(data, read);
      uiState.prices = {};
      Object.keys(read.prices).forEach(k => {
        uiState.prices[k] = { 0: read.prices[k] };
      });
      uiState.currency.value = read.currency;
    }

    loadPrices();

    const migrated = jsonReadFile(pricePath);
    assert.deepStrictEqual(migrated, {
      prices: { Gasoline: 4, Electricity: 1.2 },
      currency: 'USD'
    });
    assert.strictEqual(uiState.prices.Gasoline[0], 4);
    assert.strictEqual(uiState.prices.Electricity[0], 1.2);
    assert.strictEqual(uiState.currency.value, 'USD');
  });
});

describe('Fuel Price Editor removal', () => {
  it('removes fuel types from fuelPrice.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fuel-'));
    const map = p => path.join(tmp, p.replace(/^\//, ''));

    const pricePath = '/settings/krtektm_fuelEconomy/fuelPrice.json';
    fs.mkdirSync(path.dirname(map(pricePath)), { recursive: true });
    fs.writeFileSync(
      map(pricePath),
      JSON.stringify({ prices: { Gasoline: 1, Electricity: 2, Diesel: 3 }, currency: 'USD' })
    );

    const data = {};
    const uiState = { prices: {}, currency: { value: 'USD' } };

    const jsonWriteFile = (p, tbl) => fs.writeFileSync(map(p), JSON.stringify(tbl));
    const jsonReadFile = p => JSON.parse(fs.readFileSync(map(p), 'utf8'));

    function loadPrices() {
      const read = jsonReadFile(pricePath);
      Object.assign(data, read);
      uiState.prices = {};
      Object.keys(read.prices).forEach(k => {
        uiState.prices[k] = { 0: read.prices[k] };
      });
      uiState.currency.value = read.currency;
    }

    function savePrices() {
      data.prices = {};
      Object.keys(uiState.prices).forEach(k => {
        data.prices[k] = uiState.prices[k][0];
      });
      data.currency = uiState.currency.value;
      jsonWriteFile(pricePath, data);
      loadPrices();
    }

    function removeFuelType(name) {
      if (name === 'Gasoline' || name === 'Electricity') return;
      delete uiState.prices[name];
      savePrices();
    }

    loadPrices();
    removeFuelType('Diesel');

    const saved = jsonReadFile(pricePath);
    assert.deepStrictEqual(saved, { prices: { Gasoline: 1, Electricity: 2 }, currency: 'USD' });
  });
});

describe('Fuel Price Editor ordering', () => {
  it('lists fuel types alphabetically with currency last', () => {
    const order = [];
    const im = {
      InputFloat: name => order.push(name),
      SetNextItemWidth: () => {},
      SameLine: () => {},
      BeginDisabled: () => {},
      EndDisabled: () => {},
      Button: () => {},
      InputText: name => order.push(name)
    };
    const uiState = {
      prices: { Gasoline: { 0: 0 }, Diesel: { 0: 0 }, Electricity: { 0: 0 } },
      currency: {}
    };

    function onUpdate() {
      const names = Object.keys(uiState.prices).sort();
      names.forEach(name => {
        im.SetNextItemWidth(80);
        im.InputFloat(name, uiState.prices[name]);
        im.SameLine();
        const disabled = name === 'Gasoline' || name === 'Electricity';
        if (disabled) im.BeginDisabled();
        const label = 'Remove##' + name;
        im.Button(label);
        if (disabled) im.EndDisabled();
      });
      im.SetNextItemWidth(80);
      im.InputText('Currency', uiState.currency);
    }

    onUpdate();
    assert.deepStrictEqual(order, ['Diesel', 'Electricity', 'Gasoline', 'Currency']);
  });
});
