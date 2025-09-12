const EPS_SPEED = 0.005; // [m/s]
const MIN_VALID_SPEED_MPS = 1; // ~3.6 km/h
const MIN_RPM_RUNNING = 100; // below this rpm the engine is considered off
const DEFAULT_IDLE_FLOW_LPS = 0.0002; // ~0.72 L/h fallback when idle flow unknown
const DEFAULT_IDLE_RPM = 800; // assume typical idle speed when unknown
const MAX_CONSUMPTION = 100; // [L/100km] ignore unrealistic spikes for liquid fuels
const MAX_ELECTRIC_CONSUMPTION = 4000; // [kWh/100km] allow higher spikes for EVs
const MAX_EFFICIENCY = 100; // [km/L] cap unrealistic efficiency
const RADPS_TO_RPM = 60 / (2 * Math.PI); // convert rad/s telemetry to rpm
const FOOD_CAPACITY_KCAL = 2000;
const FOOD_REST_KCAL_PER_H = 80;
const FOOD_WALK_KCAL_PER_H = 300;
const FOOD_RUN_KCAL_PER_H = 600;
const EU_SPEED_WINDOW_MS = 10000; // retain EU speed samples for 10 s
const EMISSIONS_BASE_TEMP_C = 90; // baseline engine temp for emissions calculations

module.exports = {
  EPS_SPEED,
  MIN_VALID_SPEED_MPS,
  MIN_RPM_RUNNING,
  DEFAULT_IDLE_FLOW_LPS,
  DEFAULT_IDLE_RPM,
  MAX_CONSUMPTION,
  MAX_ELECTRIC_CONSUMPTION,
  MAX_EFFICIENCY,
  RADPS_TO_RPM,
  FOOD_CAPACITY_KCAL,
  FOOD_REST_KCAL_PER_H,
  FOOD_WALK_KCAL_PER_H,
  FOOD_RUN_KCAL_PER_H,
  EU_SPEED_WINDOW_MS,
  EMISSIONS_BASE_TEMP_C
};
