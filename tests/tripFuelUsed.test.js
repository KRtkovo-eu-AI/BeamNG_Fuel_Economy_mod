const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object
global.angular = { module: () => ({ directive: () => ({}) }) };

const { calculateFuelFlow } = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('trip fuel used tracking', () => {
  it('accumulates liquid fuel only for consumption', () => {
    let prev = 50;
    let trip = 0;
    const dt = 1;

    let curr = 49.9; // consume 0.1
    let flow = calculateFuelFlow(curr, prev, dt);
    if (flow > 0) trip += flow * dt;
    prev = curr;

    curr = 50.2; // refuel 0.3
    flow = calculateFuelFlow(curr, prev, dt);
    if (flow > 0) trip += flow * dt;
    prev = curr;

    assert.ok(Math.abs(trip - 0.1) < 1e-9);
  });

  it('allows negative electric usage from regeneration', () => {
    let prev = 50;
    let trip = 0;
    const dt = 1;

    let curr = 49.9; // consume 0.1
    let flow = calculateFuelFlow(curr, prev, dt);
    trip += flow * dt;
    prev = curr;

    curr = 49.95; // regen 0.05
    flow = calculateFuelFlow(curr, prev, dt);
    trip += flow * dt;
    prev = curr;

    assert.ok(Math.abs(trip - 0.05) < 1e-9);
  });
});
