-- Register an extra GUI stream that reports energy storage devices
-- so the OK Fuel Economy app can detect electric powertrains.

local lastHash

local function registerHandler()
  local streamsMod = streams -- vehicle's existing guistreams module
  if not (streamsMod and debug and streamsMod.update) then return end

  log('D', 'okFuelEconomy', 'energyStorageStream initializing')

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

    -- Resolve the powertrain controller; some vehicles expose it via the
    -- global 'powertrain' while others keep it under the main controller.
    local pt = powertrain
    if not pt and controller and controller.getController then
      pt = controller.getController('powertrain')
    end
    if not pt and controller and controller.mainController then
      pt = controller.mainController.powertrain
    end

    if pt and pt.getDevices then
      local devices = pt.getDevices() or {}
      for _, dev in pairs(devices) do
        if dev.category == 'energyStorage' or dev.energyStorageType or dev.type == 'fuelTank' then
          list[#list + 1] = {
            energyStorageType = dev.energyStorageType,
            type = dev.type,
            category = dev.category
          }
        end
      end
    end

    local hash = ''
    for _, dev in ipairs(list) do
      hash = hash .. (dev.type or '') .. '|'
    end
    if hash ~= lastHash then
      log('D', 'okFuelEconomy', 'energyStorage devices: ' .. dumps(list))
      lastHash = hash
    end

    guihooks.queueStream('energyStorage', list)
  end
end

registerHandler()

return {}

