-- Stream energy storage devices so UI can detect fuel type
local M = {}
local guistreams = require('vehicle/guistreams')
local logged = false

local function update()
  if guistreams and guistreams.willSend and guistreams.willSend('energyStorage') then
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

M.update = update

return M
