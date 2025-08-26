-- Register an extra GUI stream that reports energy storage devices
-- so the OK Fuel Economy app can detect electric powertrains.

local logged = false

local function registerHandler()
  local streamsMod = streams -- vehicle's existing guistreams module
  if not (streamsMod and debug and streamsMod.update) then return end

  -- Locate the private 'streamsHandlers' table inside guistreams.lua
  local handlers
  local i = 1
  while true do
    local name, value = debug.getupvalue(streamsMod.update, i)
    if not name then break end
    if name == 'streamsHandlers' then
      handlers = value
      break
    end
    i = i + 1
  end
  if not handlers then return end

  handlers.energyStorage = function()
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
end

registerHandler()

return {}

