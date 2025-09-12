const KM_PER_MILE = 1.60934;
const LITERS_PER_GALLON = 3.78541;

function getUnitLabels(mode) {
  switch (mode) {
    case 'imperial':
      return {
        distance: 'mi',
        volume: 'gal',
        consumption: 'gal/100mi',
        efficiency: 'mi/gal',
        flow: 'gal/h'
      };
    case 'electric':
      return {
        distance: 'km',
        volume: 'kWh',
        consumption: 'kWh/100km',
        efficiency: 'km/kWh',
        flow: 'kW'
      };
    case 'food':
      return {
        distance: 'km',
        volume: 'kcal',
        consumption: 'kcal/100km',
        efficiency: 'km/kcal',
        flow: 'kcal/h'
      };
    default:
      return {
        distance: 'km',
        volume: 'L',
        consumption: 'L/100km',
        efficiency: 'km/L',
        flow: 'L/h'
      };
  }
}

function formatDistance(meters, mode, decimals) {
  if (!Number.isFinite(meters)) return 'Infinity';
  const unit = getUnitLabels(mode).distance;
  let value = meters / 1000;
  if (mode === 'imperial') value = meters / (KM_PER_MILE * 1000);
  return value.toFixed(decimals) + ' ' + unit;
}

function formatVolume(liters, mode, decimals) {
  if (!Number.isFinite(liters)) return 'Infinity';
  const unit = getUnitLabels(mode).volume;
  let value = liters;
  if (mode === 'imperial') value = liters / LITERS_PER_GALLON;
  return value.toFixed(decimals) + ' ' + unit;
}

function formatConsumptionRate(lPer100km, mode, decimals) {
  if (!Number.isFinite(lPer100km)) return 'Infinity';
  const unit = getUnitLabels(mode).consumption;
  let value = lPer100km;
  if (mode === 'imperial') value = (lPer100km / LITERS_PER_GALLON) * KM_PER_MILE;
  return value.toFixed(decimals) + ' ' + unit;
}

function formatEfficiency(kmPerL, mode, decimals) {
  if (!Number.isFinite(kmPerL)) return 'Infinity';
  const unit = getUnitLabels(mode).efficiency;
  let value = kmPerL;
  if (mode === 'imperial') value = (kmPerL / KM_PER_MILE) * LITERS_PER_GALLON;
  return value.toFixed(decimals) + ' ' + unit;
}

function formatFlow(lPerHour, mode, decimals) {
  if (!Number.isFinite(lPerHour)) return 'Infinity';
  const unit = getUnitLabels(mode).flow;
  let value = lPerHour;
  if (mode === 'imperial') value = lPerHour / LITERS_PER_GALLON;
  return value.toFixed(decimals) + ' ' + unit;
}

function convertVolumeToUnit(liters, mode) {
  return mode === 'imperial' ? liters / LITERS_PER_GALLON : liters;
}

function convertDistanceToUnit(meters, mode) {
  return mode === 'imperial' ? meters / (KM_PER_MILE * 1000) : meters / 1000;
}

function convertVolumePerDistance(lPerKm, mode) {
  return mode === 'imperial'
    ? (lPerKm * KM_PER_MILE) / LITERS_PER_GALLON
    : lPerKm;
}

function extractValueUnit(str) {
  if (typeof str !== 'string') return { value: null, unit: '' };
  var trimmed = str.trim();
  if (trimmed === '') return { value: null, unit: '' };
  var parts = trimmed.split(/\s+/);
  var num = parseFloat(parts.shift());
  return { value: Number.isFinite(num) ? num : null, unit: parts.join(' ') };
}

module.exports = {
  KM_PER_MILE,
  LITERS_PER_GALLON,
  getUnitLabels,
  formatDistance,
  formatVolume,
  formatConsumptionRate,
  formatEfficiency,
  formatFlow,
  convertVolumeToUnit,
  convertDistanceToUnit,
  convertVolumePerDistance,
  extractValueUnit
};
