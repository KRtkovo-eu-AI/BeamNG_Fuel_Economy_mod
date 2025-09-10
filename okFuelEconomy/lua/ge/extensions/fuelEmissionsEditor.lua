local M = {}

local im = ui_imgui

local emissionsPath = '/settings/krtektm_fuelEconomy/fuelEmissions.json'
local emissionsDir = '/settings/krtektm_fuelEconomy/'

local defaultEmissions = {
  Gasoline = { CO2 = 2392, NOx = 10 },
  Diesel = { CO2 = 2640, NOx = 20 },
  ['LPG/CNG'] = { CO2 = 1660, NOx = 7 },
  Electricity = { CO2 = 0, NOx = 0 },
  Air = { CO2 = 0, NOx = 0 },
  Ethanol = { CO2 = 1510, NOx = 3 },
  Hydrogen = { CO2 = 0, NOx = 1 },
  Nitromethane = { CO2 = 820, NOx = 12 },
  Nitromethan = { CO2 = 820, NOx = 12 },
  Food = { CO2 = 0.001, NOx = 0 },
  Kerosene = { CO2 = 2500, NOx = 15 },
  ['Jet Fuel'] = { CO2 = 2500, NOx = 15 },
  Methanol = { CO2 = 1100, NOx = 4 },
  Biodiesel = { CO2 = 2500, NOx = 18 },
  Synthetic = { CO2 = 2392, NOx = 10 },
  ['Coal Gas'] = { CO2 = 2000, NOx = 15 },
  Steam = { CO2 = 0, NOx = 0 },
  Ammonia = { CO2 = 0, NOx = 6 },
  Hybrid = { CO2 = 2392, NOx = 10 },
  ['Plug-in Hybrid'] = { CO2 = 2392, NOx = 10 },
  ['Fuel Oil'] = { CO2 = 3100, NOx = 25 },
  ['Heavy Oil'] = { CO2 = 3100, NOx = 25 },
  Hydrazine = { CO2 = 0, NOx = 30 },
  Hypergolic = { CO2 = 0, NOx = 30 },
  ['Solid Rocket'] = { CO2 = 1900, NOx = 20 },
  ['Black Powder'] = { CO2 = 1900, NOx = 20 },
  ACPC = { CO2 = 1900, NOx = 20 }
}

local data = {}
local uiState = { emissions = {} }

local isOpen = false
local openPtr = im.BoolPtr(false)
local FIELD_WIDTH = 80

local function ensureFile()
  if not FS:directoryExists(emissionsDir) then
    FS:directoryCreate(emissionsDir)
  end
  if not FS:fileExists(emissionsPath) then
    jsonWriteFile(emissionsPath, defaultEmissions, true)
  end
end

local function loadEmissions()
  data = jsonReadFile(emissionsPath) or {}
  uiState.emissions = {}
  for k, v in pairs(data) do
    uiState.emissions[k] = {
      CO2 = im.FloatPtr(v.CO2 or 0),
      NOx = im.FloatPtr(v.NOx or 0)
    }
  end
end

local function saveEmissions()
  for k, v in pairs(uiState.emissions) do
    data[k] = { CO2 = v.CO2[0], NOx = v.NOx[0] }
  end
  jsonWriteFile(emissionsPath, data, true)
  loadEmissions()
end

local function removeFuelType(name)
  if name == 'Gasoline' or name == 'Electricity' then return end
  if uiState.emissions[name] == nil then return end
  uiState.emissions[name] = nil
  data[name] = nil
  saveEmissions()
end

local function onUpdate()
  if not isOpen then return end
  if not im.Begin('Fuel Emissions Editor', openPtr) then
    im.End()
    if not openPtr[0] then isOpen = false end
    return
  end
  local names = {}
  for name, _ in pairs(uiState.emissions) do
    table.insert(names, name)
  end
  table.sort(names)
  for _, name in ipairs(names) do
    im.Text(name .. ':')
    im.SameLine()
    im.SetNextItemWidth(FIELD_WIDTH)
    im.InputFloat('##' .. name .. 'CO2', uiState.emissions[name].CO2)
    im.SameLine()
    im.Text('CO2 g/L;')
    im.SameLine()
    im.SetNextItemWidth(FIELD_WIDTH)
    im.InputFloat('##' .. name .. 'NOx', uiState.emissions[name].NOx)
    im.SameLine()
    im.Text('NOx g/L')
    im.SameLine()
    local disabled = name == 'Gasoline' or name == 'Electricity'
    if disabled then im.BeginDisabled() end
    if im.Button('Remove##' .. name) then
      removeFuelType(name)
    end
    if disabled then im.EndDisabled() end
  end
  if im.Button('Save') then
    saveEmissions()
  end
  im.End()
  if not openPtr[0] then isOpen = false end
end

local function onExtensionLoaded()
  ensureFile()
  loadEmissions()
end

local function onFileChanged(path)
  if path == emissionsPath then
    loadEmissions()
  end
end

M.onUpdate = onUpdate
M.onExtensionLoaded = onExtensionLoaded
M.onFileChanged = onFileChanged

function M.open()
  openPtr[0] = true
  isOpen = true
end

return M

