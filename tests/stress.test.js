const assert = require('node:assert');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  smoothFuelFlow,
  trimQueue,
  calculateRange,
  calculateMedian,
  MIN_VALID_SPEED_MPS
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

// Driving segments used for repeated environment cycles
const segments = [
  { name: 'launch', duration: 100, speed: 30, flow: 0.004, throttle: 0.8 },
  { name: 'coastNoIdle', duration: 100, speed: 20, flow: 0, throttle: 0, expectZero: true },
  { name: 'city', duration: 100, speed: 0, flow: 0.001, throttle: 0 },
  { name: 'mountains', duration: 100, speed: 15, flow: 0.004, throttle: 0.6 },
  { name: 'countryside', duration: 100, speed: 20, flow: 0.002, throttle: 0.5 },
  { name: 'highway', duration: 100, speed: 35, flow: 0.003, throttle: 0.7 },
  { name: 'snow', duration: 100, speed: 10, flow: 0.0045, throttle: 0.6 },
  { name: 'summer', duration: 100, speed: 25, flow: 0.0025, throttle: 0.5 },
  { name: 'desert', duration: 100, speed: 8, flow: 0.0035, throttle: 0.5 },
  { name: 'engineBrake', duration: 100, speed: 15, flow: 0.004, throttle: 0, expectIdleSame: true },
  { name: 'coast', duration: 100, speed: 20, flow: 0, throttle: 0, expectZero: true },
  { name: 'sport', duration: 100, speed: 30, flow: 0.004, throttle: 0.8 },
  { name: 'offroad', duration: 100, speed: 12, flow: 0.003, throttle: 0.6 },
  { name: 'combined', duration: 100, speed: 22, flow: 0.0022, throttle: 0.5 }
];

const dt = 1;
const capacity = 60;
const expectedFuelUsed = segments.reduce((s, seg) => s + seg.flow * seg.duration, 0);
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
      const current = fuel - seg.flow * dt;
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
      if (seg.expectZero) {
        if (t === 0) startFlow = flow;
        if (t === seg.duration - 1) endFlow = flow;
      }
      const inst = calculateInstantConsumption(flow, seg.speed);
      if (seg.speed < MIN_VALID_SPEED_MPS) {
        assert.strictEqual(inst, (flow * 3600) / 4);
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
    if (seg.expectZero) {
      assert.strictEqual(startFlow, 0);
      assert.strictEqual(endFlow, 0);
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

// Accelerated stress test covering multiple realistic gameplay scenarios
test('accelerated multi-scenario stress simulation', { timeout: 120000 }, async () => {
  const EPS_SPEED = 0.005;

  const scenarios = [
    {
      capacity: 60,
      minDistance: 20000,
      segments: [
        { duration: 5, speed: 0, flow: 0, throttle: 0 }, // spawn with engine off
        { duration: 300, speed: 15, flow: 0.002, throttle: 0.5 }, // city
        { duration: 5, speed: 0, flow: 0, throttle: 0, refuel: true }, // pit stop
        { duration: 400, speed: 35, flow: 0.003, throttle: 0.7 }, // highway
        { duration: 5, speed: 0, flow: 0, throttle: 0, switchVehicle: { capacity: 80 } }, // vehicle swap
        { duration: 300, speed: 20, flow: 0.004, throttle: 0.8 }, // mountains
        { duration: 100, speed: 1.5, flow: 0, throttle: 0, expectZero: true }, // walking on foot
        { duration: 200, speed: 25, flow: 0.0025, throttle: 0.6, resetTrip: true } // countryside
      ]
    },
    {
      capacity: 70,
      minDistance: 15000,
      segments: [
        { duration: 5, speed: 0, flow: 0, throttle: 0 },
        { duration: 200, speed: 30, flow: 0.0035, throttle: 0.8 }, // drag race
        { duration: 200, speed: 0, flow: 0, throttle: 0 }, // cooldown
        { duration: 300, speed: 12, flow: 0.001, throttle: 0.4 }, // city EV
        { duration: 5, speed: 0, flow: 0, throttle: 0, refuel: true },
        { duration: 300, speed: 40, flow: 0.005, throttle: 1 } // highway sprint
      ]
    },
    {
      capacity: 50,
      minDistance: 10000,
      segments: [
        { duration: 5, speed: 0, flow: 0, throttle: 0 },
        { duration: 250, speed: 20, flow: 0.0022, throttle: 0.5 }, // mixed
        { duration: 150, speed: 10, flow: 0.0035, throttle: 0.6 }, // offroad
        { duration: 200, speed: 25, flow: 0.0025, throttle: 0.6 }, // return
        { duration: 100, speed: 0, flow: 0, throttle: 0, refuel: true },
        { duration: 250, speed: 30, flow: 0.003, throttle: 0.7 } // highway
      ]
    }
  ];

  async function runScenario(cfg) {
    let capacity = cfg.capacity;
    let fuel = capacity;
    let prev = fuel;
    let distance = 0;
    let trip = 0;
    const queue = [];
    let lastFlow = 0;
    let idleFlow = 0;
    let lastThrottle = 0;

    for (const seg of cfg.segments) {
      if (seg.switchVehicle) {
        capacity = seg.switchVehicle.capacity;
        fuel = capacity;
        prev = fuel;
      }
      if (seg.refuel) {
        fuel = capacity;
        prev = fuel;
      }
      if (seg.resetTrip) {
        trip = 0;
      }
      const idleBefore = idleFlow;
      let startFlow, endFlow;
      for (let t = 0; t < seg.duration; t += dt) {
        const current = fuel - seg.flow * dt;
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
        if (seg.expectZero) {
          if (t === 0) startFlow = flow;
          if (t === seg.duration - 1) endFlow = flow;
        }
        const inst = calculateInstantConsumption(flow, seg.speed);
        if (seg.speed < MIN_VALID_SPEED_MPS) {
          assert.strictEqual(inst, (flow * 3600) / 4);
        } else {
          assert.ok(Number.isFinite(inst));
        }
        queue.push(inst);
        trimQueue(queue, 500);
        distance += seg.speed * dt;
        trip += seg.speed * dt;
        fuel = current;
        prev = current;
        lastFlow = flow;
      }
      lastThrottle = seg.throttle;
      if (seg.expectZero) {
        assert.strictEqual(startFlow, 0);
        assert.strictEqual(endFlow, 0);
      }
      if (seg.expectIdleSame) {
        assert.strictEqual(idleFlow, idleBefore);
      }
    }

    assert.ok(distance >= cfg.minDistance);
    assert.ok(queue.length <= 500);
  }

  await Promise.all(scenarios.map(runScenario));
});

// Ensure trip values persist across restart cycles and only reset on manual request
test('restart and manual reset cycle', () => {
  let directiveDef;
  const store = {};

  function startSession() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fuel-'));
    const prevDir = process.env.KRTEKTM_BNG_USER_DIR;
    process.env.KRTEKTM_BNG_USER_DIR = tmp;
    global.angular = { module: () => ({ directive: (n, arr) => { directiveDef = arr[0](); } }) };
    global.StreamsManager = { add: () => {}, remove: () => {} };
    global.UiUnits = { buildString: () => '' };
    global.bngApi = { engineLua: () => '' };
    global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
    let now = 0; global.performance = { now: () => now };
    delete require.cache[require.resolve('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js')];
    require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');
    const controller = directiveDef.controller[directiveDef.controller.length - 1];
    const $scope = { $on: (n, cb) => { $scope['on_' + n] = cb; }, $evalAsync: fn => fn() };
    controller({ debug: () => {} }, $scope);
    if (prevDir === undefined) delete process.env.KRTEKTM_BNG_USER_DIR; else process.env.KRTEKTM_BNG_USER_DIR = prevDir;
    $scope.fuelPrices.Gasoline = 2;
    $scope.liquidFuelPriceValue = 2; // ensure costs are non-zero
    return { $scope, setTime: t => { now = t; } };
  }

  // First game session with some liquid consumption
  const sess1 = startSession();
  const streams = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 20, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
  streams.engineInfo[11] = 60; streams.engineInfo[12] = 80;
  sess1.setTime(0); sess1.$scope.on_streamsUpdate(null, streams);
  streams.engineInfo[11] = 59;
  sess1.setTime(1000); sess1.$scope.on_streamsUpdate(null, streams);
  assert.strictEqual(sess1.$scope.tripFuelUsedLiquid, '1.00 L');
  assert.strictEqual(sess1.$scope.tripTotalCostLiquid, '2.00 money');

  // Simulate game restart and verify persistence
  const sess2 = startSession();
  assert.strictEqual(sess2.$scope.tripFuelUsedLiquid, '1.00 L');
  assert.strictEqual(sess2.$scope.tripTotalCostLiquid, '2.00 money');

  // Consume electric energy in second session
  sess2.$scope.unitMode = 'electric';
  sess2.$scope.electricityPriceValue = 5;
  const streamsE = { engineInfo: Array(15).fill(0), electrics: { wheelspeed: 20, throttle_input: 0.5, rpmTacho: 1000, trip: 0 } };
  streamsE.engineInfo[11] = 60; streamsE.engineInfo[12] = 80;
  sess2.setTime(2000); sess2.$scope.on_streamsUpdate(null, streamsE);
  streamsE.engineInfo[11] = 59;
  sess2.setTime(3000); sess2.$scope.on_streamsUpdate(null, streamsE);
  assert.strictEqual(sess2.$scope.tripFuelUsedElectric, '1.00 kWh');
  assert.strictEqual(sess2.$scope.tripTotalCostElectric, '5.00 money');

  // Restart again and ensure both fuel types persist
  const sess3 = startSession();
  assert.strictEqual(sess3.$scope.tripFuelUsedLiquid, '1.00 L');
  assert.strictEqual(sess3.$scope.tripTotalCostLiquid, '2.00 money');
  assert.strictEqual(sess3.$scope.tripFuelUsedElectric, '1.00 kWh');
  assert.strictEqual(sess3.$scope.tripTotalCostElectric, '5.00 money');

  // Manual trip reset clears stored values
  sess3.$scope.reset();
  assert.strictEqual(sess3.$scope.tripFuelUsedLiquid, '');
  assert.strictEqual(sess3.$scope.tripTotalCostLiquid, '');
  assert.strictEqual(sess3.$scope.tripFuelUsedElectric, '');
  assert.strictEqual(sess3.$scope.tripTotalCostElectric, '');

  // After reset, values remain cleared across restart
  const sess4 = startSession();
  assert.strictEqual(sess4.$scope.tripFuelUsedLiquid, '');
  assert.strictEqual(sess4.$scope.tripTotalCostLiquid, '');
  assert.strictEqual(sess4.$scope.tripFuelUsedElectric, '');
  assert.strictEqual(sess4.$scope.tripTotalCostElectric, '');
});

// Ensure median calculation recovers after extended idle periods
test('median recovery after long idle', () => {
  const idle = 0.3;
  const queue = Array(20000).fill(idle);
  for (let i = 0; i < 100; i++) queue.push(8 + (i % 5));
  const med = calculateMedian(queue);
  assert.ok(med >= 8 && med <= 12);
});
