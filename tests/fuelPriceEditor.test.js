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
      liquid: { 0: 0 },
      electric: { 0: 0 },
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
      if (!FS.fileExists(pricePath)) jsonWriteFile(pricePath, { liquidFuelPrice: 0, electricityPrice: 0, currency: 'money' });
    }

    function loadPrices() {
      Object.assign(data, jsonReadFile(pricePath));
      uiState.liquid[0] = data.liquidFuelPrice;
      uiState.electric[0] = data.electricityPrice;
      uiState.currency.value = data.currency;
    }

    function savePrices() {
      data.liquidFuelPrice = uiState.liquid[0];
      data.electricityPrice = uiState.electric[0];
      data.currency = uiState.currency.value;
      jsonWriteFile(pricePath, data);
      loadPrices();
    }

    ensureFile();
    loadPrices();
    uiState.liquid[0] = 3.7;
    uiState.electric[0] = 1.6;
    uiState.currency.value = 'EUR';
    savePrices();

    const saved = jsonReadFile(pricePath);
    assert.deepStrictEqual(saved, { liquidFuelPrice: 3.7, electricityPrice: 1.6, currency: 'EUR' });
  });
});
