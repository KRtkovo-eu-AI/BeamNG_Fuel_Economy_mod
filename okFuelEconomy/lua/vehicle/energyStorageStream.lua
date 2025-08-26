-- Register an extra GUI stream that reports energy storage devices
-- so the OK Fuel Economy app can detect electric powertrains.

local lastHash

local function registerHandler()
  local streamsMod = streams -- vehicle's existing guistreams module
  if not (streamsMod and debug and streamsMod.update) then return end

  log('D', 'okFuelEconomy', 'energyStorageStream initializing')

  -- Make sure the built-in energyStorage extension is available
  if extensions and extensions.load then
    extensions.load('energyStorage')
  end

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

    -- The dedicated energyStorage extension exposes fuel tanks and batteries.
    -- Prefer it when available as the powertrain device list often omits
    -- these components.
    local es
    if energyStorage then
      es = energyStorage
    elseif controller and controller.getController then
      es = controller.getController('energyStorage')
    end

    if es and es.getDevices then
      local ok, devices = pcall(es.getDevices, es)
      devices = ok and devices or {}
      for _, dev in pairs(devices) do
        list[#list + 1] = {
          energyStorageType = dev.energyStorageType,
          type = dev.type,
          category = dev.category
        }
      end
    else
      -- Fallback: try scanning the powertrain for energy storage devices.
      local pt
      if powertrain then
        pt = powertrain
      elseif controller and controller.getController then
        pt = controller.getController('powertrain')
      elseif controller and controller.mainController then
        pt = controller.mainController.powertrain
      end

      if pt and pt.getDevices then
        local ok, devices = pcall(pt.getDevices, pt)
        devices = ok and devices or {}
        for _, dev in pairs(devices) do
          local t = string.lower(dev.energyStorageType or dev.type or dev.category or '')
          if t:find('battery') or t:find('capacitor') or t:find('fuel') then
            list[#list + 1] = {
              energyStorageType = dev.energyStorageType,
              type = dev.type,
              category = dev.category
            }
          end
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

