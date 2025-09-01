const assert = require('node:assert');
const { test } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  smoothFuelFlow,
  trimQueue,
  calculateRange,
  MIN_VALID_SPEED_MPS
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

// Driving segments used for repeated environment cycles
const segments = [
  { name: 'launch', duration: 100, speed: 30, flow: 0.004, throttle: 0.8 },
  { name: 'coastNoIdle', duration: 100, speed: 20, flow: 0, throttle: 0, expectDecay: true, initialRaw: 0.003 },
  { name: 'city', duration: 100, speed: 0, flow: 0.001, throttle: 0 },
  { name: 'mountains', duration: 100, speed: 15, flow: 0.004, throttle: 0.6 },
  { name: 'countryside', duration: 100, speed: 20, flow: 0.002, throttle: 0.5 },
  { name: 'highway', duration: 100, speed: 35, flow: 0.003, throttle: 0.7 },
  { name: 'snow', duration: 100, speed: 10, flow: 0.0045, throttle: 0.6 },
  { name: 'summer', duration: 100, speed: 25, flow: 0.0025, throttle: 0.5 },
  { name: 'desert', duration: 100, speed: 8, flow: 0.0035, throttle: 0.5 },
  { name: 'engineBrake', duration: 100, speed: 15, flow: 0.004, throttle: 0, expectIdleSame: true },
  { name: 'coast', duration: 100, speed: 20, flow: 0, throttle: 0, expectCoastIdle: true },
  { name: 'sport', duration: 100, speed: 30, flow: 0.004, throttle: 0.8 },
  { name: 'offroad', duration: 100, speed: 12, flow: 0.003, throttle: 0.6 },
  { name: 'combined', duration: 100, speed: 22, flow: 0.0022, throttle: 0.5 }
];

const dt = 1;
const capacity = 60;
const expectedFuelUsed = segments.reduce((s, seg) => s + seg.flow * seg.duration + (seg.initialRaw || 0), 0);
const expectedDistance = segments.reduce((s, seg) => s + seg.speed * seg.duration, 0);

function runCycle() {
  const EPS_SPEED = 0.005;
  let fuel = capacity;
  let prev = fuel;
  let distance = 0;
  const queue = [];
  let lastFlow = 0;
  let idleFlow = 0;
  let lastThrottle = segments[0].throttle;

  for (const seg of segments) {
    const idleBefore = idleFlow;
    let startFlow, endFlow;
    if (seg.throttle <= 0.05 && lastThrottle > 0.05) {
      prev = fuel;
    }
    for (let t = 0; t < seg.duration; t += dt) {
      let flowInput = seg.flow;
      if (seg.initialRaw && t === 0) flowInput = seg.initialRaw;
      const current = fuel - flowInput * dt;
      const raw = calculateFuelFlow(current, prev, dt);
      if (seg.speed <= EPS_SPEED && seg.throttle <= 0.05 && raw > 0) {
        idleFlow = raw;
      }
      const flow = smoothFuelFlow(
        raw,
        seg.speed,
        seg.throttle,
        lastFlow,
        idleFlow,
        EPS_SPEED
      );
      if (seg.expectDecay || seg.expectCoastIdle) {
        if (t === 0) startFlow = flow;
        if (t === seg.duration - 1) endFlow = flow;
      }
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
      prev = current;
      lastFlow = flow;
    }
    lastThrottle = seg.throttle;
    if (seg.expectIdleSame) {
      assert.strictEqual(idleFlow, idleBefore);
    }
    if (seg.expectCoastIdle) {
      assert.ok(startFlow > idleFlow);
      assert.ok(Math.abs(endFlow - idleFlow) < 1e-9);
    }
    if (seg.expectDecay) {
      assert.ok(startFlow > endFlow);
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
  const EPS_SPEED = 0.005;
  let fuel = capacity;
  let prev = fuel;
  let trip = 0;
  let distance = 0;
  const queue = [];
  let lastFlow = 0;
  let lastMeasuredFlow = 0;
  let idleFlow = 0.001;

  const end = Date.now() + 30_000; // run for ~30s
  while (Date.now() < end) {
    const speed = Math.random() * 40; // m/s
    const throttle = Math.random();
    const raw = throttle > 0.1 ? Math.random() * 0.005 : 0; // L/s change
    const current = fuel - raw * dt;
    let flowRate = calculateFuelFlow(current, prev, dt);
    if (flowRate > 0) {
      lastMeasuredFlow = flowRate;
    }
    if (speed <= EPS_SPEED && throttle <= 0.05 && flowRate > 0) {
      idleFlow = flowRate;
    }
    flowRate = smoothFuelFlow(flowRate, speed, throttle, lastFlow, idleFlow, EPS_SPEED);
    if (throttle <= 0.05 && speed > EPS_SPEED && raw === 0 && idleFlow > 0) {
      assert.ok(flowRate > 0);
    }
    const inst = calculateInstantConsumption(flowRate, speed);

    if (speed < MIN_VALID_SPEED_MPS) {
      assert.strictEqual(inst, flowRate * 3600);
    } else {
      assert.ok(Number.isFinite(inst));
    }

    queue.push(inst);
    trimQueue(queue, 500);

    distance += speed * dt;
    trip += speed * dt;
    fuel = current;
    prev = current;
    lastFlow = flowRate;

    // Occasionally simulate a vehicle reset (fuel to full, distance reset) but keep trip
    if (Math.random() < 0.1) {
      fuel = capacity;
      prev = null;
      distance = 0;
    }

    const avg = distance > 0 ? ((capacity - fuel) / distance) * 100000 : -1;
    const range = calculateRange(fuel, avg, speed, EPS_SPEED);
    assert.ok(Number.isFinite(range) || range === Infinity);

    // small delay so the loop lasts ~30 seconds
    await new Promise(r => setTimeout(r, 10));
  }

  assert.ok(trip > 0);
  assert.ok(Number.isFinite(trip));
});
