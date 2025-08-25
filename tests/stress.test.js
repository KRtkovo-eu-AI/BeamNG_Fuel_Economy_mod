const assert = require('node:assert');
const { test } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  trimQueue,
  calculateRange
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

// Driving segments used for repeated environment cycles
const segments = [
  { name: 'mountains', duration: 100, speed: 15, flow: 0.004 },
  { name: 'countryside', duration: 100, speed: 20, flow: 0.002 },
  { name: 'highway', duration: 100, speed: 35, flow: 0.003 },
  { name: 'snow', duration: 100, speed: 10, flow: 0.0045 },
  { name: 'summer', duration: 100, speed: 25, flow: 0.0025 },
  { name: 'desert', duration: 100, speed: 8, flow: 0.0035 },
  { name: 'city', duration: 100, speed: 0, flow: 0.001 },
  { name: 'sport', duration: 100, speed: 30, flow: 0.004 },
  { name: 'offroad', duration: 100, speed: 12, flow: 0.003 },
  { name: 'combined', duration: 100, speed: 22, flow: 0.0022 }
];

const dt = 1;
const capacity = 60;
const expectedFuelUsed = segments.reduce((s, seg) => s + seg.flow * seg.duration, 0);
const expectedDistance = segments.reduce((s, seg) => s + seg.speed * seg.duration, 0);

function runCycle() {
  let fuel = capacity;
  let prev = fuel;
  let distance = 0;
  const queue = [];

  for (const seg of segments) {
    for (let t = 0; t < seg.duration; t += dt) {
      const current = fuel - seg.flow * dt;
      const flow = calculateFuelFlow(current, prev, dt);
      const inst = calculateInstantConsumption(flow, seg.speed);
      if (seg.speed === 0) {
        assert.strictEqual(inst, Infinity);
      } else {
        assert.ok(Number.isFinite(inst));
      }
      queue.push(inst);
      trimQueue(queue, 500);
      distance += seg.speed * dt;
      fuel = current;
      prev = current;
    }
  }

  const fuelUsed = capacity - fuel;
  return { fuelUsed, distance, queueLength: queue.length, fuel };
}

// Repeat the full environment cycle multiple times to ensure stability
for (let run = 1; run <= 3; run++) {
  test(`environment cycle repeat ${run}`, () => {
    const { fuelUsed, distance, queueLength } = runCycle();
    assert.ok(Math.abs(fuelUsed - expectedFuelUsed) < 1e-9);
    assert.ok(Math.abs(distance - expectedDistance) < 1e-9);
    assert.ok(queueLength <= 500);
  });
}

// Long running randomised simulation lasting around 30 seconds
// Simulates repeated vehicle resets without trip resets
// and varying driving conditions in random order.
test('30-second random stress simulation', { timeout: 70000 }, async () => {
  let fuel = capacity;
  let prev = fuel;
  let trip = 0;
  let distance = 0;
  const queue = [];

  const end = Date.now() + 30_000; // run for ~30s
  while (Date.now() < end) {
    const speed = Math.random() * 40; // m/s
    const flow = Math.random() * 0.005; // L/s
    const current = fuel - flow * dt;
    const flowRate = calculateFuelFlow(current, prev, dt);
    const inst = calculateInstantConsumption(flowRate, speed);

    if (speed === 0) {
      assert.strictEqual(inst, Infinity);
    } else {
      assert.ok(Number.isFinite(inst));
    }

    queue.push(inst);
    trimQueue(queue, 500);

    distance += speed * dt;
    trip += speed * dt;
    fuel = current;
    prev = current;

    // Occasionally simulate a vehicle reset (fuel to full, distance reset) but keep trip
    if (Math.random() < 0.1) {
      fuel = capacity;
      prev = null;
      distance = 0;
    }

    const avg = distance > 0 ? ( (capacity - fuel) / distance ) * 100000 : -1;
    const range = calculateRange(fuel, avg, speed, 0.005);
    assert.ok(Number.isFinite(range) || range === Infinity);

    // small delay so the loop lasts ~30 seconds
    await new Promise(r => setTimeout(r, 10));
  }

  assert.ok(trip > 0);
  assert.ok(Number.isFinite(trip));
});
