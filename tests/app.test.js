const assert = require('node:assert');
const { describe, it } = require('node:test');

// Stub minimal angular object so the module can be required in Node.
global.angular = { module: () => ({ directive: () => ({}) }) };

const {
  calculateFuelFlow,
  calculateInstantConsumption,
  smoothFuelFlow,
  trimQueue,
  calculateMedian,
  calculateAverage,
  calculateAverageConsumption,
  calculateRange,
  buildQueueGraphPoints,
  resolveSpeed,
  resolveAverageConsumption,
  isEngineRunning,
  formatDistance,
  formatVolume,
  formatConsumptionRate,
  formatEfficiency,
  formatFlow,
  calculateCO2gPerKm,
  formatCO2,
  classifyCO2,
  meetsEuCo2Limit,
  MIN_VALID_SPEED_MPS,
  MAX_CONSUMPTION,
  resolveUnitModeForFuelType,
  formatFuelTypeLabel,
  getUnitLabels
} = require('../okFuelEconomy/ui/modules/apps/okFuelEconomy/app.js');

const KM_PER_MILE = 1.60934;

describe('app.js utility functions', () => {
  describe('calculateFuelFlow', () => {
    it('handles missing previous fuel', () => {
      assert.strictEqual(calculateFuelFlow(10, null, 1), 0);
    });
    it('handles non-positive dt', () => {
      assert.strictEqual(calculateFuelFlow(10, 12, 0), 0);
    });
    it('computes fuel flow', () => {
      assert.strictEqual(calculateFuelFlow(10, 12, 2), 1);
    });
    it('returns negative when fuel increases (refuel)', () => {
      assert.strictEqual(calculateFuelFlow(12, 10, 2), -1);
    });
  });

  describe('calculateInstantConsumption', () => {
    it('computes instant consumption', () => {
      assert.strictEqual(
        calculateInstantConsumption(0.002, 20),
        0.002 / 20 * 100000
      );
    });
    it('uses quarter-hourly rate when stationary', () => {
      assert.strictEqual(
        calculateInstantConsumption(0.001, 0),
        (0.001 * 3600) / 4
      );
    });
    it('applies quarter-hourly estimate below the minimum threshold', () => {
      assert.strictEqual(
        calculateInstantConsumption(0.001, MIN_VALID_SPEED_MPS / 2),
        (0.001 * 3600) / 4
      );
    });
    it('propagates negative fuel flow', () => {
      assert.strictEqual(
        calculateInstantConsumption(-0.001, 10),
        -0.001 / 10 * 100000
      );
    });
    it('caps unrealistic values', () => {
      assert.strictEqual(
        calculateInstantConsumption(2, 0),
        MAX_CONSUMPTION
      );
    });
  });

  describe('trimQueue', () => {
    it('trims oldest entries to max size', () => {
      const queue = [];
      for (let i = 0; i < 10; i++) queue.push(i);
      trimQueue(queue, 5);
      assert.strictEqual(queue.length, 5);
      assert.deepStrictEqual(queue, [5, 6, 7, 8, 9]);
    });
    it('empties queue when maxEntries is zero', () => {
      const queue = [1, 2, 3];
      trimQueue(queue, 0);
      assert.deepStrictEqual(queue, []);
    });
  });

  describe('calculateMedian', () => {
    it('handles empty queues', () => {
      assert.strictEqual(calculateMedian([]), 0);
    });
    it('computes median for odd and even counts', () => {
      assert.strictEqual(calculateMedian([1, 3, 2]), 2);
      assert.strictEqual(calculateMedian([1, 2, 3, 4]), 2.5);
    });
    it('ignores repeated idle-level minimum values', () => {
      const idle = 0.25;
      const queue = Array(1000).fill(idle).concat([20, 30, 40, 50]);
      assert.strictEqual(calculateMedian(queue), 30);
    });
  });

  describe('calculateAverage', () => {
    it('handles empty queues', () => {
      assert.strictEqual(calculateAverage([]), 0);
    });
    it('computes the arithmetic mean', () => {
      assert.strictEqual(calculateAverage([10, 20, 30]), 20);
    });
  });

  describe('meetsEuCo2Limit', () => {
    it('accepts values at or below 120 g/km', () => {
      assert.ok(meetsEuCo2Limit(120));
      assert.ok(meetsEuCo2Limit(95));
    });
    it('rejects values above the limit', () => {
      assert.ok(!meetsEuCo2Limit(130));
    });
  });

  describe('calculateAverageConsumption', () => {
    it('computes L/100km from fuel and distance', () => {
      assert.strictEqual(calculateAverageConsumption(5, 100000), 5);
    });
    it('handles zero distance', () => {
      assert.strictEqual(calculateAverageConsumption(5, 0), 0);
    });
    it('formats realistic averages without rounding to zero', () => {
      const avg = calculateAverageConsumption(6, 100000);
      assert.strictEqual(formatConsumptionRate(avg, 'metric', 1), '6.0 L/100km');
    });
  });

  describe('smoothFuelFlow', () => {
    const EPS_SPEED = 0.005;
    it('retains last flow when throttle applied but fuel reading static', () => {
      const last = 0.01;
      const res = smoothFuelFlow(0, 5, 0.6, last, 0.002, 800, 2000, EPS_SPEED);
      assert.strictEqual(res, last);
    });
    it('scales idle flow with rpm when coasting without sensor flow', () => {
      const idle = 0.005;
      const res = smoothFuelFlow(0, 5, 0, 0.03, idle, 800, 2400, EPS_SPEED);
      assert.ok(Math.abs(res - idle * 2400 / 800) < 1e-9);
    });
    it('updates to new positive flow', () => {
      const res = smoothFuelFlow(0.02, 5, 0.7, 0.01, 0.005, 800, 2000, EPS_SPEED);
      assert.strictEqual(res, 0.02);
    });
    it('uses new positive flow even with zero throttle', () => {
      const res = smoothFuelFlow(0.015, 20, 0, 0.01, 0.005, 800, 1800, EPS_SPEED);
      assert.strictEqual(res, 0.015);
    });
    it('returns idle flow when stopped without sensor flow', () => {
      const idle = 0.005;
      const res = smoothFuelFlow(0, 0, 0, 0.01, idle, 800, 800, EPS_SPEED);
      assert.ok(Math.abs(res - idle) < 1e-9);
    });
    it('uses fallback scaled by rpm when idle is unknown', () => {
      const rpm = 2000;
      const res = smoothFuelFlow(0, 25, 0, 0.03, 0, 0, rpm, EPS_SPEED);
      const expected = 0.0002 * rpm / 800;
      assert.ok(Math.abs(res - expected) < 1e-9);
    });
    it('passes through negative flow for regeneration', () => {
      const res = smoothFuelFlow(-0.01, 10, 0, 0, 0, 0, 0, EPS_SPEED);
      assert.strictEqual(res, -0.01);
    });
    it('reports zero flow for stationary electric vehicles', () => {
      const res = smoothFuelFlow(0.01, 0, 0, 0.01, 0.005, 800, 0, EPS_SPEED, true);
      assert.strictEqual(res, 0);
    });
  });

  describe('calculateRange', () => {
    const EPS_SPEED = 0.005;
    it('computes finite range when consuming fuel', () => {
      assert.strictEqual(calculateRange(1, 5, 1, EPS_SPEED), 20000);
    });
    it('computes infinite range when moving without consumption', () => {
      assert.strictEqual(calculateRange(10, 0, 1, EPS_SPEED), Infinity);
    });
    it('computes zero range when stopped without consumption', () => {
      assert.strictEqual(calculateRange(10, 0, 0, EPS_SPEED), 0);
    });
    it('treats negative avg as no consumption while moving', () => {
      assert.strictEqual(calculateRange(10, -5, 1, EPS_SPEED), Infinity);
    });
    it('treats negative avg as no consumption while stopped', () => {
      assert.strictEqual(calculateRange(10, -5, 0, EPS_SPEED), 0);
    });
  });

  describe('resolveAverageConsumption', () => {
    it('resets averages when engine is off', () => {
      const recent = { queue: [5] };
      const avg = resolveAverageConsumption(false, 0, recent, 3);
      assert.strictEqual(avg, 0);
      assert.deepStrictEqual(recent.queue, []);
    });
    it('averages samples while running', () => {
      const recent = { queue: [10] };
      const avg = resolveAverageConsumption(true, 20, recent, 5);
      assert.strictEqual(avg, 15);
      assert.deepStrictEqual(recent.queue, [10, 20]);
    });
    it('trims old samples beyond max entries', () => {
      const recent = { queue: [1, 2, 3] };
      resolveAverageConsumption(true, 4, recent, 3);
      assert.deepStrictEqual(recent.queue, [2, 3, 4]);
    });
    it('does not snap to idle after one low sample', () => {
      const recent = { queue: [20, 20, 20, 20, 20] };
      const avg = resolveAverageConsumption(true, 5, recent, 5);
      assert.ok(avg > 5 && avg < 20);
    });
    it('starts fresh after engine restarts', () => {
      const recent = { queue: [10, 20] };
      resolveAverageConsumption(false, 0, recent, 5);
      const avg = resolveAverageConsumption(true, 30, recent, 5);
      assert.strictEqual(avg, 30);
      assert.deepStrictEqual(recent.queue, [30]);
    });

    it('drops negative samples to prevent underflow', () => {
      const recent = { queue: [15] };
      const avg = resolveAverageConsumption(true, -10, recent, 5);
      assert.strictEqual(avg, 0);
      assert.deepStrictEqual(recent.queue, []);
    });
  });

  describe('buildQueueGraphPoints', () => {
    it('returns empty string for short queues', () => {
      assert.strictEqual(buildQueueGraphPoints([1], 100, 40), '');
    });
    it('scales values to width and height', () => {
      const pts = buildQueueGraphPoints([0, 100], 100, 40);
      assert.strictEqual(pts, '0.0,40.0 100.0,0.0');
    });
    it('handles intermediate values', () => {
      const pts = buildQueueGraphPoints([0, 50, 100], 100, 40);
      assert.strictEqual(pts, '0.0,40.0 50.0,20.0 100.0,0.0');
    });
    it('handles zero max values', () => {
      assert.strictEqual(buildQueueGraphPoints([0, 0], 100, 40), '');
    });
  });

  describe('resolveSpeed', () => {
    const EPS_SPEED = 0.005;
    it('zeroes wheel speed when airspeed indicates standing still', () => {
      const s = resolveSpeed(10, 0, EPS_SPEED);
      assert.strictEqual(s, 0);
    });
    it('prevents distance growth while stationary', () => {
      const dt = 1;
      let distance = 0;
      distance += resolveSpeed(15, 0, EPS_SPEED) * dt;
      assert.strictEqual(distance, 0);
    });
    it('prefers airspeed when available', () => {
      const s = resolveSpeed(5, 8, EPS_SPEED);
      assert.strictEqual(s, 8);
    });
    it('falls back to wheel speed when airspeed missing', () => {
      const s = resolveSpeed(7, undefined, EPS_SPEED);
      assert.strictEqual(s, 7);
    });
  });

  describe('isEngineRunning', () => {
    it('prefers the engineRunning flag when present', () => {
      assert.strictEqual(
        isEngineRunning({ engineRunning: false, rpmTacho: 800 }, []),
        false
      );
      assert.strictEqual(
        isEngineRunning({ engineRunning: true, rpmTacho: 0 }, []),
        true
      );
    });
    it('falls back to ignition level', () => {
      assert.strictEqual(
        isEngineRunning({ ignitionLevel: 0, rpmTacho: 900 }, []),
        false
      );
      assert.strictEqual(
        isEngineRunning({ ignitionLevel: 2, rpmTacho: 0 }, []),
        true
      );
    });
    it('uses rpm as a last resort', () => {
      assert.strictEqual(isEngineRunning({ rpmTacho: 700 }, []), true);
      assert.strictEqual(isEngineRunning({ rpmTacho: 10 }, []), false);
      assert.strictEqual(isEngineRunning({}, []), false);
    });
  });

  describe('unit formatting', () => {
    it('formats metric distance', () => {
      assert.strictEqual(formatDistance(1000, 'metric', 1), '1.0 km');
    });
    it('formats imperial volume', () => {
      assert.strictEqual(formatVolume(3.78541, 'imperial', 2), '1.00 gal');
    });
    it('formats electric consumption', () => {
      assert.strictEqual(
        formatConsumptionRate(10, 'electric', 1),
        '10.0 kWh/100km'
      );
    });
    it('formats imperial efficiency', () => {
      assert.strictEqual(formatEfficiency(10, 'imperial', 2), '23.52 mi/gal');
    });
    it('formats flow in kW', () => {
      assert.strictEqual(formatFlow(5, 'electric', 1), '5.0 kW');
    });
  });

  describe('resolveUnitModeForFuelType', () => {
    it('uses electric units for electric storages', () => {
      assert.strictEqual(
        resolveUnitModeForFuelType('electricEnergy', 'metric'),
        'electric'
      );
    });
    it('falls back to preferred liquid units for non-electric', () => {
      assert.strictEqual(
        resolveUnitModeForFuelType('diesel', 'imperial'),
        'imperial'
      );
    });
    it('uses food units for Food fuel type', () => {
      assert.strictEqual(
        resolveUnitModeForFuelType('Food', 'metric'),
        'food'
      );
    });
  });

  describe('formatFuelTypeLabel', () => {
    it('maps electric energy types to "Electricity"', () => {
      assert.strictEqual(formatFuelTypeLabel('electricEnergy'), 'Electricity');
    });
    it('maps compressed gas to "LPG/CNG"', () => {
      assert.strictEqual(formatFuelTypeLabel('compressedGas'), 'LPG/CNG');
    });
    it('capitalizes other types', () => {
      assert.strictEqual(formatFuelTypeLabel('diesel'), 'Diesel');
    });
    it('returns "None" for empty fuel types', () => {
      assert.strictEqual(formatFuelTypeLabel(''), 'None');
    });
  });

  describe('getUnitLabels', () => {
    it('provides kcal-based labels for food mode', () => {
      assert.deepStrictEqual(getUnitLabels('food'), {
        distance: 'km',
        volume: 'kcal',
        consumption: 'kcal/100km',
        efficiency: 'km/kcal',
        flow: 'kcal/h'
      });
    });
  });

  describe('formatting for food mode', () => {
    it('formats volume values in kcal', () => {
      assert.strictEqual(formatVolume(123.456, 'food', 1), '123.5 kcal');
    });
    it('formats consumption rates in kcal/100km', () => {
      assert.strictEqual(
        formatConsumptionRate(12.34, 'food', 1),
        '12.3 kcal/100km'
      );
    });
    it('formats efficiency in km/kcal', () => {
      assert.strictEqual(formatEfficiency(56.789, 'food', 2), '56.79 km/kcal');
    });
  });

  describe('CO2 helpers', () => {
    it('computes g/km from consumption and fuel type', () => {
      assert.strictEqual(calculateCO2gPerKm(5, 'Gasoline'), 5 / 100 * 2392);
      assert.strictEqual(calculateCO2gPerKm(5, 'Diesel'), 5 / 100 * 2640);
      assert.strictEqual(calculateCO2gPerKm(5, 'LPG/CNG'), 5 / 100 * 1660);
      assert.strictEqual(calculateCO2gPerKm(5, 'Air'), 0);
      assert.strictEqual(calculateCO2gPerKm(5, 'Ethanol'), 5 / 100 * 1510);
      assert.strictEqual(calculateCO2gPerKm(5, 'Nitromethane'), 5 / 100 * 820);
      assert.strictEqual(calculateCO2gPerKm(5, 'Nitromethan'), 5 / 100 * 820);
      assert.ok(Math.abs(calculateCO2gPerKm(5, 'Food') - 5 / 100 * 0.001) < 1e-9);
    });
    it('formats CO2 emissions', () => {
      const val = calculateCO2gPerKm(5, 'Gasoline');
      assert.strictEqual(
        formatCO2(val, 1, 'metric'),
        (5 / 100 * 2392).toFixed(1) + ' g/km'
      );
      assert.strictEqual(
        formatCO2(val, 1, 'imperial'),
        ((5 / 100 * 2392) * KM_PER_MILE).toFixed(1) + ' g/mi'
      );
    });
    it('classifies emission levels', () => {
      assert.strictEqual(classifyCO2(119), 'A');
      assert.strictEqual(classifyCO2(130), 'B');
      assert.strictEqual(classifyCO2(160), 'D');
    });

    it('estimates total emissions for a 1 km trip', () => {
      const perKm = calculateCO2gPerKm(5, 'Gasoline');
      const totalKg = perKm / 1000; // 1 km distance
      assert.ok(Math.abs(totalKg - 0.1196) < 1e-6);
    });
  });

  describe('Canadian 5-cycle fuel economy scenario', () => {
    it('derives city and highway ratings with CO2 grades', () => {
      const cycles = [
        // fuel used in L, distance in m for each of the five tests
        { fuel: 1.3175, dist: 17566.7 }, // city
        { fuel: 0.845, dist: 16900 }, // highway
        { fuel: 1.581, dist: 17566.7 }, // cold city
        { fuel: 0.4666, dist: 5833.3 }, // air conditioning
        { fuel: 0.78, dist: 13000 } // high speed
      ];
      const l100 = cycles.map(c => calculateAverageConsumption(c.fuel, c.dist));
      const cityAvg = (l100[0] + l100[2] + l100[3] + l100[4]) / 4;
      const hwyAvg = (l100[1] + l100[3] + l100[4]) / 3;
      const cityCO2 = calculateCO2gPerKm(cityAvg, 'Gasoline');
      const hwyCO2 = calculateCO2gPerKm(hwyAvg, 'Gasoline');
      assert.ok(Math.abs(cityAvg - 7.625) < 1e-3);
      assert.ok(Math.abs(hwyAvg - 6.333333) < 1e-3);
      assert.strictEqual(classifyCO2(cityCO2), 'E');
      assert.strictEqual(classifyCO2(hwyCO2), 'C');
    });
  });

  describe('EU urban and extra-urban fuel economy scenario', () => {
    it('derives cycle ratings and combined compliance', () => {
      const urbanFuel = 0.16;
      const extraFuel = 0.2;
      const urbanDist = 4052; // m
      const extraDist = 6955.6; // m
      const urbanAvg = calculateAverageConsumption(urbanFuel, urbanDist);
      const extraAvg = calculateAverageConsumption(extraFuel, extraDist);
      const combinedAvg = (urbanAvg + extraAvg) / 2;
      const urbanCO2 = calculateCO2gPerKm(urbanAvg, 'Gasoline');
      const extraCO2 = calculateCO2gPerKm(extraAvg, 'Gasoline');
      const combinedCO2 = calculateCO2gPerKm(combinedAvg, 'Gasoline');
      assert.strictEqual(classifyCO2(urbanCO2), 'A');
      assert.strictEqual(classifyCO2(extraCO2), 'A');
      assert.ok(meetsEuCo2Limit(combinedCO2));
    });
  });
});
