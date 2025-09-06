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

local function migrate(cfg)
  local migrated = false
  cfg.prices = cfg.prices or {}
  if cfg.prices.Gasoline == nil and cfg.liquidFuelPrice ~= nil then
    cfg.prices.Gasoline = cfg.liquidFuelPrice
    cfg.liquidFuelPrice = nil
    migrated = true
  end
  if cfg.prices.Electricity == nil and cfg.electricityPrice ~= nil then
    cfg.prices.Electricity = cfg.electricityPrice
    cfg.electricityPrice = nil
    migrated = true
  end
  if cfg.prices.Gasoline == nil then
    cfg.prices.Gasoline = 0
    migrated = true
  end
  if cfg.prices.Electricity == nil then
    cfg.prices.Electricity = 0
    migrated = true
  end
  if cfg.currency == nil then
    cfg.currency = 'money'
    migrated = true
  end
  return cfg, migrated
end

local function ensureFile()
  if not FS:directoryExists(priceDir) then
    FS:directoryCreate(priceDir)
  end
  if not FS:fileExists(pricePath) then
    jsonWriteFile(pricePath, {prices = {Gasoline = 0, Electricity = 0}, currency = 'money'}, true)
  else
    local cfg = jsonReadFile(pricePath) or {}
    local migrated
    cfg, migrated = migrate(cfg)
    if migrated then
      jsonWriteFile(pricePath, cfg, true)
    end
  end
end

local function loadPrices()
  data = jsonReadFile(pricePath) or {}
  local migrated
  data, migrated = migrate(data)
  if migrated then
    jsonWriteFile(pricePath, data, true)
  end
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

local function removeFuelType(name)
  if name == 'Gasoline' or name == 'Electricity' then return end
  if uiState.prices[name] == nil then return end
  uiState.prices[name] = nil
  data.prices = data.prices or {}
  data.prices[name] = nil
  savePrices()
end

local function onUpdate()
  im.Begin('Fuel Price Editor')
  local names = {}
  for name, _ in pairs(uiState.prices) do
    table.insert(names, name)
  end
  table.sort(names)
  for _, name in ipairs(names) do
    im.InputFloat(name, uiState.prices[name])
    im.SameLine()
    local disabled = name == 'Gasoline' or name == 'Electricity'
    if disabled then im.BeginDisabled() end
    if im.Button('Remove##' .. name) then
      removeFuelType(name)
    end
    if disabled then im.EndDisabled() end
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
  local cfg = jsonReadFile(pricePath) or {}
  local migrated
  cfg, migrated = migrate(cfg)
  if cfg.prices[label] == nil then
    cfg.prices[label] = 0
    migrated = true
  end
  if migrated then
    jsonWriteFile(pricePath, cfg, true)
    loadPrices()
  end
end

return M
