local M = {}

local im = ui_imgui

local configPath = '/settings/krtektm_fuelEconomy/settings.json'
local configDir = '/settings/krtektm_fuelEconomy/'

local data = { order = {}, visible = {} }
local uiState = { order = {}, visible = {} }

local defaultOrder = {
  'heading',
  'distanceMeasured',
  'distanceEcu',
  'fuelUsed',
  'fuelLeft',
  'fuelCap',
  'fuelType',
  'costPrice',
  'avgCost',
  'totalCost',
  'avgL100km',
  'avgKmL',
  'avgGraph',
  'avgKmLGraph',
  'avgCO2',
  'instantLph',
  'instantL100km',
  'instantKmL',
  'instantGraph',
  'instantKmLGraph',
  'instantCO2',
  'range',
  'tripAvgL100km',
  'tripAvgKmL',
  'tripAvgCO2',
  'tripTotalCO2',
  'tripGraph',
  'tripKmLGraph',
  'tripDistance',
  'tripRange',
  'tripFuelUsed',
  'tripAvgCost',
  'tripTotalCost',
  'tripReset'
}

local function ensureFile()
  if not FS:directoryExists(configDir) then
    FS:directoryCreate(configDir)
  end
  if not FS:fileExists(configPath) then
    local visible = {}
    for _, k in ipairs(defaultOrder) do visible[k] = true end
    jsonWriteFile(configPath, { order = defaultOrder, visible = visible }, true)
  end
end

local function loadConfig()
  local cfg = jsonReadFile(configPath) or {}
  cfg.order = cfg.order or {}
  cfg.visible = cfg.visible or {}
  if #cfg.order == 0 then cfg.order = defaultOrder end
  data = cfg
  uiState.order = {}
  uiState.visible = {}
  for _, k in ipairs(cfg.order) do
    table.insert(uiState.order, k)
    uiState.visible[k] = im.BoolPtr(cfg.visible[k] ~= false)
  end
  for _, k in ipairs(defaultOrder) do
    if uiState.visible[k] == nil then
      table.insert(uiState.order, k)
      uiState.visible[k] = im.BoolPtr(true)
    end
  end
end

local function saveConfig()
  data.order = uiState.order
  data.visible = {}
  for k, ptr in pairs(uiState.visible) do
    data.visible[k] = ptr[0]
  end
  jsonWriteFile(configPath, data, true)
  loadConfig()
  be:executeJS('if window.reloadFuelEconomySettings then reloadFuelEconomySettings() end')
end

local function onUpdate()
  im.Begin('Fuel Economy Settings')
  for i, key in ipairs(uiState.order) do
    im.Checkbox(key, uiState.visible[key])
    im.SameLine()
    if im.Button('Up##' .. key) and i > 1 then
      uiState.order[i], uiState.order[i-1] = uiState.order[i-1], uiState.order[i]
    end
    im.SameLine()
    if im.Button('Down##' .. key) and i < #uiState.order then
      uiState.order[i], uiState.order[i+1] = uiState.order[i+1], uiState.order[i]
    end
  end
  if im.Button('Save') then
    saveConfig()
  end
  im.End()
end

local function onExtensionLoaded()
  ensureFile()
  loadConfig()
end

local function onFileChanged(path)
  if path == configPath then
    loadConfig()
  end
end

M.onUpdate = onUpdate
M.onExtensionLoaded = onExtensionLoaded
M.onFileChanged = onFileChanged

return M

