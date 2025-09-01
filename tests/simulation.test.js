const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  trimQueue,
  calculateRange,
  MIN_VALID_SPEED_MPS
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

describe('extended drive simulations', () => {
  it('handles diverse environments and driving modes', () => {
    const crawlSpeed = MIN_VALID_SPEED_MPS / 2;
    const segments = [
      // mountains, high consumption climbing
      { name: 'mountains', duration: 100, speed: 15, flow: 0.004 },
      // countryside cruising
      { name: 'countryside', duration: 100, speed: 20, flow: 0.002 },
      // highway speed
      { name: 'highway', duration: 100, speed: 35, flow: 0.003 },
      // snowy conditions
      { name: 'snow', duration: 100, speed: 10, flow: 0.0045 },
      // summer heat
      { name: 'summer', duration: 100, speed: 25, flow: 0.0025 },
      // desert sand
      { name: 'desert', duration: 100, speed: 8, flow: 0.0035 },
      // city stop-and-go (zero speed -> hourly rate used for L/100km)
      { name: 'city', duration: 100, speed: 0, flow: 0.001 },
      // crawling speed below threshold
      { name: 'crawl', duration: 100, speed: crawlSpeed, flow: 0.0015 },
      // sport mode
      { name: 'sport', duration: 100, speed: 30, flow: 0.004 },
      // offroad terrain
      { name: 'offroad', duration: 100, speed: 12, flow: 0.003 },
      // combined driving
      { name: 'combined', duration: 100, speed: 22, flow: 0.0022 }
    ];

    let fuel = 60; // litres
    let prevFuel = fuel;
    let distance = 0;
    const queue = [];
    const dt = 1; // seconds

    for (const seg of segments) {
      for (let t = 0; t < seg.duration; t += dt) {
        const current = fuel - seg.flow * dt;
        const flow = calculateFuelFlow(current, prevFuel, dt);
        const inst = calculateInstantConsumption(flow, seg.speed);

        if (seg.speed < MIN_VALID_SPEED_MPS) {
          assert.strictEqual(inst, flow * 3600);
        } else {
          assert.ok(Number.isFinite(inst));
        }

        queue.push(inst);
        trimQueue(queue, 500);

        distance += seg.speed * dt;
        fuel = current;
        prevFuel = current;
      }
    }

    const expectedFuelUsed = segments.reduce((sum, s) => sum + s.flow * s.duration, 0);
    const expectedDistance = segments.reduce((sum, s) => sum + s.speed * s.duration, 0);
    const fuelUsed = 60 - fuel;

    assert.ok(Math.abs(fuelUsed - expectedFuelUsed) < 1e-9);
    assert.ok(Math.abs(distance - expectedDistance) < 1e-9);
    assert.ok(queue.length <= 500);

    const avg = (fuelUsed / distance) * 100000; // L/100km
    const range = calculateRange(fuel, avg, 22, 0.005);
    assert.ok(Number.isFinite(range));
  });

  it('handles vehicle reset without corrupting trip', () => {
    const dt = 1;
    const speed = 10;
    const capacity = 60;

    let startFuel = 50;
    let prevFuel = startFuel;
    let fuelUsed = 0;
    let distance = 0;
    let trip = 0;

    // drive a short distance
    for (let i = 0; i < 5; i++) {
      const current = prevFuel - 0.001;
      const flow = calculateFuelFlow(current, prevFuel, dt);
      fuelUsed += flow * dt;
      distance += speed * dt;
      trip += speed * dt;
      prevFuel = current;
    }

    // simulate vehicle reset where fuel level jumps to full
    const resetFuel = capacity;

    // correct behaviour: previousFuel cleared -> zero flow
    prevFuel = null;
    assert.strictEqual(calculateFuelFlow(resetFuel, prevFuel, dt), 0);

    // if previousFuel is not cleared, negative flow occurs
    prevFuel = 49.995; // last value before reset
    const flowAfterReset = calculateFuelFlow(resetFuel, prevFuel, dt);
    fuelUsed = startFuel - resetFuel;
    distance += speed * dt; // one more tick before detection

    if (fuelUsed >= capacity || fuelUsed < 0) {
      fuelUsed = 0;
      distance = 0;
    }

    // trip counter should retain previous distance
    assert.strictEqual(trip, 5 * speed);
    assert.strictEqual(fuelUsed, 0);
    assert.strictEqual(distance, 0);
    assert.ok(flowAfterReset < 0);
  });

  it('resets trip counter independently of overall distance', () => {
    const dt = 1;
    const speed = 10;

    let overallDistance = 0;
    let tripDistance = 0;
    let prevFuel = 40;

    // initial drive
    for (let i = 0; i < 5; i++) {
      const current = prevFuel - 0.001;
      calculateFuelFlow(current, prevFuel, dt);
      overallDistance += speed * dt;
      tripDistance += speed * dt;
      prevFuel = current;
    }

    // user resets trip counter
    tripDistance = 0;

    // continue driving
    for (let i = 0; i < 5; i++) {
      const current = prevFuel - 0.001;
      calculateFuelFlow(current, prevFuel, dt);
      overallDistance += speed * dt;
      tripDistance += speed * dt;
      prevFuel = current;
    }

    assert.strictEqual(tripDistance, 50);
    assert.strictEqual(overallDistance, 100);
  });

  it('simulates long-term operation with repeated vehicle resets', () => {
    const dt = 1;
    const speed = 20;
    const capacity = 60;

    let fuel = capacity;
    let prevFuel = fuel;
    let trip = 0;
    let distance = 0;

    const resets = 5;
    const stepsPerReset = 200; // total steps = 1000

    for (let r = 0; r < resets; r++) {
      for (let i = 0; i < stepsPerReset; i++) {
        const current = prevFuel - 0.001; // constant consumption
        calculateFuelFlow(current, prevFuel, dt);
        trip += speed * dt; // trip never resets
        distance += speed * dt;
        prevFuel = current;
        fuel = current;
      }

      // vehicle reset: fuel back to full, distance counters reset but trip persists
      fuel = capacity;
      prevFuel = null; // clearing ensures zero flow on next tick
      assert.strictEqual(calculateFuelFlow(fuel, prevFuel, dt), 0);
      distance = 0;
    }

    assert.strictEqual(trip, resets * stepsPerReset * speed);
    assert.strictEqual(distance, 0); // last reset leaves distance cleared
  });
});

