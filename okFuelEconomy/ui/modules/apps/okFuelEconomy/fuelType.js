function formatFuelTypeLabel(fuelType) {
  if (typeof fuelType === 'string') {
    var lower = fuelType.toLowerCase();
    if (!lower) {
      return 'None';
    }
    if (lower.indexOf('electric') !== -1) {
      return 'Electricity';
    }
    if (lower === 'compressedgas') {
      return 'LPG/CNG';
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return fuelType || 'None';
}

function resolveUnitModeForFuelType(fuelType, liquidMode) {
  if (typeof fuelType === 'string') {
    var lower = fuelType.toLowerCase();
    if (lower.indexOf('electric') !== -1) {
      return 'electric';
    }
    if (lower === 'food') {
      return 'food';
    }
  }
  return liquidMode;
}

function resolveFuelType(prevType, rawType) {
  if (!rawType) return prevType || '';
  return rawType;
}

function shouldResetOnFoot(prevType, currentType) {
  if (!currentType) return false;
  var lower = currentType.toLowerCase();
  return lower === 'food' && prevType !== currentType;
}

module.exports = {
  formatFuelTypeLabel,
  resolveUnitModeForFuelType,
  resolveFuelType,
  shouldResetOnFoot
};
