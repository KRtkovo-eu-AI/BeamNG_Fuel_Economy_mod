const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  smoothFuelFlow,
  calculateInstantConsumption,
  calculateCO2gPerKm,
  EPS_SPEED,
  MIN_RPM_RUNNING,
  normalizeRpm
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

const RADPS_TO_RPM = 60 / (2 * Math.PI);

describe('coasting behaviour', () => {
  it('updates instant consumption and CO2 as RPM drops during coasting', () => {
    const speed = 27.8; // ~100 km/h
    const lastFlow = 0.02; // L/s prior to coasting
    const idleFlow = 0.0005; // measured idle
    const throttle = 0;
    const idleRpm = 800;

    const flow1 = smoothFuelFlow(0, speed, throttle, lastFlow, idleFlow, idleRpm, 3000, EPS_SPEED);
    const flow2 = smoothFuelFlow(0, speed, throttle, flow1, idleFlow, idleRpm, 1500, EPS_SPEED);
    const inst1 = calculateInstantConsumption(flow1, speed);
    const inst2 = calculateInstantConsumption(flow2, speed);
    const co2 = calculateCO2gPerKm(inst2, 'Gasoline');

    assert.ok(Math.abs(flow1 - idleFlow * 3000 / idleRpm) < 1e-9);
    assert.ok(Math.abs(flow2 - idleFlow * 1500 / idleRpm) < 1e-9);
    assert.ok(flow1 > flow2);
    assert.ok(inst1 > inst2);
    assert.ok(co2 > 0);
  });

  it('interprets rad/s values above 300 when engineRunning is false', () => {
    const speed = 27.8;
    const lastFlow = 0.02;
    const idleFlow = 0.0005;
    const throttle = 0;
    const idleRpm = 800;
    const rpmRad = 3000 / RADPS_TO_RPM;
    const rpm = normalizeRpm(rpmRad, false);
    const flow = smoothFuelFlow(0, speed, throttle, lastFlow, idleFlow, idleRpm, rpm, EPS_SPEED);
    assert.ok(Math.abs(flow - idleFlow * 3000 / idleRpm) < 1e-9);
  });

  it('keeps instant metrics non-zero when engineRunning flag is false', () => {
    const speed = 27.8;
    const lastFlow = 0.02;
    const idleFlow = 0.0005;
    const throttle = 0;
    const idleRpm = 800;
    const rpm = normalizeRpm(2000 / RADPS_TO_RPM, false);
    const fuelFlow = smoothFuelFlow(0, speed, throttle, lastFlow, idleFlow, idleRpm, rpm, EPS_SPEED);
    const sampleValid = (false || rpm >= MIN_RPM_RUNNING) && fuelFlow >= 0;
    const inst = sampleValid ? calculateInstantConsumption(fuelFlow, speed) : 0;
    const co2 = calculateCO2gPerKm(inst, 'Gasoline');
    assert.ok(sampleValid);
    assert.ok(inst > 0);
    assert.ok(co2 > 0);
  });
});
