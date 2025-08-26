-- Stream energy storage devices via a dedicated handler, similar to guistreams
-- This module mirrors BeamNG's guistreams.lua but only exposes an additional
-- "energyStorage" stream so that the UI can detect fuel type reliably.

local M = {}

local streamControl = {}
local streamsHandlers = {}
local logged = false

local function willSend(name)
  return guihooks.updateStreams and streamControl[name]
end

local function reset()
  streamControl = {}
end

streamsHandlers.energyStorage = function()
  local list = {}
  if powertrain and powertrain.getDevicesOfType then
    local devices = powertrain.getDevicesOfType('energyStorage') or {}
    for _, dev in pairs(devices) do
      list[#list + 1] = { energyStorageType = dev.energyStorageType }
    end
  end
  if not logged then
    log('D', 'okFuelEconomy', 'energyStorage devices: ' .. dumps(list))
    logged = true
  end
  guihooks.queueStream('energyStorage', list)
end

local function update()
  for k, _ in pairs(streamControl) do
    local handler = streamsHandlers[k]
    if handler then
      handler()
    end
  end
end

local function setRequiredStreams(state)
  table.clear(streamControl)
  for _, streamName in pairs(state) do
    streamControl[streamName] = true
  end
end

local function hasActiveStreams()
  return next(streamControl) ~= nil
end

-- public interface
M.reset = reset
M.update = update
M.setRequiredStreams = setRequiredStreams
M.willSend = willSend
M.hasActiveStreams = hasActiveStreams

return M

