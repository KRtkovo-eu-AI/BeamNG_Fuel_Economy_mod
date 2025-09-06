local M = {}

local im = ui_imgui
local ffi = require('ffi')

local pricePath = '/settings/krtektm_fuelEconomy/fuelPrice.json'
local priceDir = '/settings/krtektm_fuelEconomy/'
local data = {}
local uiState = {
  prices = {},
  currency = im.ArrayChar(32, 'money')
}

local function ensureFile()
  if not FS:directoryExists(priceDir) then
    FS:directoryCreate(priceDir)
  end
  if not FS:fileExists(pricePath) then
    jsonWriteFile(pricePath, {prices = {Gasoline = 0, Electricity = 0}, currency = 'money'}, true)
  end
end

local function loadPrices()
  data = jsonReadFile(pricePath) or {}
  data.prices = data.prices or {}
  if data.prices.Gasoline == nil and data.liquidFuelPrice ~= nil then
    data.prices.Gasoline = data.liquidFuelPrice
    data.liquidFuelPrice = nil
  end
  if data.prices.Electricity == nil and data.electricityPrice ~= nil then
    data.prices.Electricity = data.electricityPrice
    data.electricityPrice = nil
  end
  if data.prices.Gasoline == nil then data.prices.Gasoline = 0 end
  if data.prices.Electricity == nil then data.prices.Electricity = 0 end
  uiState.prices = {}
  for k, v in pairs(data.prices) do
    uiState.prices[k] = im.FloatPtr(v or 0)
  end
  uiState.currency = im.ArrayChar(32, data.currency or 'money')
end

local function savePrices()
  data.prices = data.prices or {}
  for k, ptr in pairs(uiState.prices) do
    data.prices[k] = ptr[0]
  end
  data.currency = ffi.string(uiState.currency)
  jsonWriteFile(pricePath, data, true)
  loadPrices()
end

local function onUpdate()
  im.Begin('Fuel Price Editor')
  for name, ptr in pairs(uiState.prices) do
    im.InputFloat(name, ptr)
  end
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

function M.ensureFuelType(label)
  ensureFile()
  local cfg = jsonReadFile(pricePath) or {prices = {}, currency = 'money'}
  cfg.prices = cfg.prices or {}
  if cfg.prices[label] == nil then
    cfg.prices[label] = 0
    jsonWriteFile(pricePath, cfg, true)
    loadPrices()
  end
end

return M
