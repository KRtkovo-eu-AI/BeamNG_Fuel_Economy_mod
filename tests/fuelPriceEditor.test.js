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
});
