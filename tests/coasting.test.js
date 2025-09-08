const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  smoothFuelFlow,
  calculateInstantConsumption,
  calculateCO2gPerKm,
  EPS_SPEED
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('coasting behaviour', () => {
  it('keeps instant consumption and CO2 non-zero when coasting', () => {
    const speed = 27.8; // ~100 km/h
    const lastFlow = 0.02; // L/s prior to coasting
    const idleFlow = 0; // idle unknown
    const throttle = 0;

    const flow = smoothFuelFlow(0, speed, throttle, lastFlow, idleFlow, EPS_SPEED);
    const inst = calculateInstantConsumption(flow, speed);
    const co2 = calculateCO2gPerKm(inst, 'Gasoline');

    assert.ok(flow > 0);
    assert.ok(inst > 0);
    assert.ok(co2 > 0);
  });
});
