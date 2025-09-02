local M = {}

local im = ui_imgui
local ffi = require('ffi')

local pricePath = '/settings/krtektm_fuelEconomy/fuelPrice.json'
local priceDir = '/settings/krtektm_fuelEconomy/'
local data = {}
local uiState = {
  liquid = im.FloatPtr(0),
  electric = im.FloatPtr(0),
  currency = im.ArrayChar(32, 'money')
}

local function ensureFile()
  if not FS:directoryExists(priceDir) then
    FS:directoryCreate(priceDir)
  end
  if not FS:fileExists(pricePath) then
    jsonWriteFile(pricePath, {liquidFuelPrice = 0, electricityPrice = 0, currency = 'money'}, true)
  end
end

local function loadPrices()
  data = jsonReadFile(pricePath) or {}
  uiState.liquid = im.FloatPtr(data.liquidFuelPrice or 0)
  uiState.electric = im.FloatPtr(data.electricityPrice or 0)
  uiState.currency = im.ArrayChar(32, data.currency or 'money')
end

local function savePrices()
  data.liquidFuelPrice = uiState.liquid[0]
  data.electricityPrice = uiState.electric[0]
  data.currency = ffi.string(uiState.currency)
  jsonWriteFile(pricePath, data, true)
  loadPrices()
end

local function onUpdate()
  im.Begin('Fuel Price Editor')

  im.InputFloat('Liquid fuel price', uiState.liquid)
  im.InputFloat('Electricity price', uiState.electric)
  im.InputText('Currency', uiState.currency)

  if im.Button('Save') then
    savePrices()
  end

  im.End()
end

local function onExtensionLoaded()
  ensureFile()
  loadPrices()
end

local function onFileChanged(path)
  if path == pricePath then
    loadPrices()
  end
end

M.onUpdate = onUpdate
M.onExtensionLoaded = onExtensionLoaded
M.onFileChanged = onFileChanged

return M
