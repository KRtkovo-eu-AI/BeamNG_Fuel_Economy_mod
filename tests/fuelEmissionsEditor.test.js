const assert = require('node:assert');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Fuel Emissions Editor saving', () => {
  it('saves edited emissions to fuelEmissions.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emedit-'));
    const map = p => path.join(tmp, p.replace(/^\//, ''));

    const emPath = '/settings/krtektm_fuelEconomy/fuelEmissions.json';
    const emDir = '/settings/krtektm_fuelEconomy/';

    const L_PER_GAL = 3.78541;
    const data = {};
    let liquidUnit = 'L';
    const uiState = { emissions: {} };

    const FS = {
      directoryExists: p => fs.existsSync(map(p)),
      directoryCreate: p => fs.mkdirSync(map(p), { recursive: true }),
      fileExists: p => fs.existsSync(map(p))
    };

    const jsonWriteFile = (p, tbl) => fs.writeFileSync(map(p), JSON.stringify(tbl));
    const jsonReadFile = p => JSON.parse(fs.readFileSync(map(p), 'utf8'));

    function ensureFile() {
      if (!FS.directoryExists(emDir)) FS.directoryCreate(emDir);
      if (!FS.fileExists(emPath)) {
        jsonWriteFile(emPath, {
          Gasoline: { CO2: 2392, NOx: 10 },
          Electricity: { CO2: 0, NOx: 0 }
        });
      }
    }

    function loadEmissions() {
      const read = jsonReadFile(emPath);
      Object.assign(data, read);
      uiState.emissions = {};
      const factor = liquidUnit === 'gal' ? L_PER_GAL : 1;
      Object.keys(read).forEach(k => {
        let co2 = read[k].CO2;
        let nox = read[k].NOx;
        if (k !== 'Electricity') {
          co2 *= factor;
          nox *= factor;
        }
        uiState.emissions[k] = {
          CO2: { 0: co2 },
          NOx: { 0: nox }
        };
      });
    }

    function saveEmissions() {
      const factor = liquidUnit === 'gal' ? L_PER_GAL : 1;
      const out = {};
      Object.keys(uiState.emissions).forEach(k => {
        let co2 = uiState.emissions[k].CO2[0];
        let nox = uiState.emissions[k].NOx[0];
        if (k !== 'Electricity') {
          co2 = co2 / factor;
          nox = nox / factor;
        }
        out[k] = { CO2: co2, NOx: nox };
      });
      for (const k of Object.keys(data)) delete data[k];
      Object.assign(data, out);
      jsonWriteFile(emPath, data);
      loadEmissions();
    }

    ensureFile();
    loadEmissions();
    uiState.emissions.Gasoline.CO2[0] = 2500;
    uiState.emissions.Gasoline.NOx[0] = 11;
    saveEmissions();

    const saved = jsonReadFile(emPath);
    assert.deepStrictEqual(saved, {
      Gasoline: { CO2: 2500, NOx: 11 },
      Electricity: { CO2: 0, NOx: 0 }
    });
  });
});

describe('Fuel Emissions Editor removal', () => {
  it('removes fuel types from fuelEmissions.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emedit-'));
    const map = p => path.join(tmp, p.replace(/^\//, ''));

    const emPath = '/settings/krtektm_fuelEconomy/fuelEmissions.json';
    fs.mkdirSync(path.dirname(map(emPath)), { recursive: true });
    fs.writeFileSync(
      map(emPath),
      JSON.stringify({
        Gasoline: { CO2: 1, NOx: 2 },
        Electricity: { CO2: 0, NOx: 0 },
        Diesel: { CO2: 3, NOx: 4 }
      })
    );

    const L_PER_GAL = 3.78541;
    const data = {};
    let liquidUnit = 'L';
    const uiState = { emissions: {} };

    const jsonWriteFile = (p, tbl) => fs.writeFileSync(map(p), JSON.stringify(tbl));
    const jsonReadFile = p => JSON.parse(fs.readFileSync(map(p), 'utf8'));

    function loadEmissions() {
      const read = jsonReadFile(emPath);
      Object.assign(data, read);
      uiState.emissions = {};
      const factor = liquidUnit === 'gal' ? L_PER_GAL : 1;
      Object.keys(read).forEach(k => {
        let co2 = read[k].CO2;
        let nox = read[k].NOx;
        if (k !== 'Electricity') {
          co2 *= factor;
          nox *= factor;
        }
        uiState.emissions[k] = {
          CO2: { 0: co2 },
          NOx: { 0: nox }
        };
      });
    }

    function saveEmissions() {
      const factor = liquidUnit === 'gal' ? L_PER_GAL : 1;
      const out = {};
      Object.keys(uiState.emissions).forEach(k => {
        let co2 = uiState.emissions[k].CO2[0];
        let nox = uiState.emissions[k].NOx[0];
        if (k !== 'Electricity') {
          co2 = co2 / factor;
          nox = nox / factor;
        }
        out[k] = { CO2: co2, NOx: nox };
      });
      for (const k of Object.keys(data)) delete data[k];
      Object.assign(data, out);
      jsonWriteFile(emPath, data);
      loadEmissions();
    }

    function removeFuelType(name) {
      if (name === 'Gasoline' || name === 'Electricity') return;
      delete uiState.emissions[name];
      saveEmissions();
    }

    loadEmissions();
    removeFuelType('Diesel');

    const saved = jsonReadFile(emPath);
    assert.deepStrictEqual(saved, {
      Gasoline: { CO2: 1, NOx: 2 },
      Electricity: { CO2: 0, NOx: 0 }
    });
  });
});

describe('Fuel Emissions Editor unit conversion', () => {
  it('converts values when switching between liters and gallons', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'emedit-'));
    const map = p => path.join(tmp, p.replace(/^\//, ''));

    const emPath = '/settings/krtektm_fuelEconomy/fuelEmissions.json';
    fs.mkdirSync(path.dirname(map(emPath)), { recursive: true });
    fs.writeFileSync(
      map(emPath),
      JSON.stringify({ Gasoline: { CO2: 100, NOx: 10 }, Electricity: { CO2: 0, NOx: 0 } })
    );

    const L_PER_GAL = 3.78541;
    const data = {};
    let liquidUnit = 'L';
    const uiState = { emissions: {} };

    const jsonWriteFile = (p, tbl) => fs.writeFileSync(map(p), JSON.stringify(tbl));
    const jsonReadFile = p => JSON.parse(fs.readFileSync(map(p), 'utf8'));

    function loadEmissions() {
      const read = jsonReadFile(emPath);
      Object.assign(data, read);
      uiState.emissions = {};
      const factor = liquidUnit === 'gal' ? L_PER_GAL : 1;
      Object.keys(read).forEach(k => {
        let co2 = read[k].CO2;
        let nox = read[k].NOx;
        if (k !== 'Electricity') {
          co2 *= factor;
          nox *= factor;
        }
        uiState.emissions[k] = { CO2: { 0: co2 }, NOx: { 0: nox } };
      });
    }

    function saveEmissions() {
      const factor = liquidUnit === 'gal' ? L_PER_GAL : 1;
      const out = {};
      Object.keys(uiState.emissions).forEach(k => {
        let co2 = uiState.emissions[k].CO2[0];
        let nox = uiState.emissions[k].NOx[0];
        if (k !== 'Electricity') {
          co2 = co2 / factor;
          nox = nox / factor;
        }
        out[k] = { CO2: co2, NOx: nox };
      });
      for (const k of Object.keys(data)) delete data[k];
      Object.assign(data, out);
      jsonWriteFile(emPath, data);
      loadEmissions();
    }

    loadEmissions();
    liquidUnit = 'gal';
    loadEmissions();
    assert.strictEqual(uiState.emissions.Gasoline.CO2[0], 100 * L_PER_GAL);
    uiState.emissions.Gasoline.CO2[0] = 200 * L_PER_GAL;
    saveEmissions();
    const saved = jsonReadFile(emPath);
    assert.strictEqual(saved.Gasoline.CO2, 200);
  });
});

describe('Fuel Emissions Editor ordering', () => {
  it('lists fuel types alphabetically', () => {
    const order = [];
    const im = {
      Text: () => {},
      SetNextItemWidth: () => {},
      InputFloat: label => order.push(label),
      SameLine: () => {},
      BeginDisabled: () => {},
      EndDisabled: () => {},
      Button: () => {}
    };
    const uiState = {
      emissions: {
        Gasoline: { CO2: {}, NOx: {} },
        Diesel: { CO2: {}, NOx: {} },
        Electricity: { CO2: {}, NOx: {} }
      }
    };

    function onUpdate() {
      const names = Object.keys(uiState.emissions).sort();
      names.forEach(name => {
        im.Text(name + ':');
        im.SameLine();
        im.SetNextItemWidth();
        im.InputFloat('##' + name + 'CO2', uiState.emissions[name].CO2);
        im.SameLine();
        im.Text('CO2 g/L;');
        im.SameLine();
        im.SetNextItemWidth();
        im.InputFloat('##' + name + 'NOx', uiState.emissions[name].NOx);
        im.SameLine();
        im.Text('NOx g/L');
        im.SameLine();
        const disabled = name === 'Gasoline' || name === 'Electricity';
        if (disabled) im.BeginDisabled();
        im.Button('Remove##' + name);
        if (disabled) im.EndDisabled();
      });
    }

    onUpdate();
    assert.deepStrictEqual(order, [
      '##DieselCO2',
      '##DieselNOx',
      '##ElectricityCO2',
      '##ElectricityNOx',
      '##GasolineCO2',
      '##GasolineNOx'
    ]);
  });
});
