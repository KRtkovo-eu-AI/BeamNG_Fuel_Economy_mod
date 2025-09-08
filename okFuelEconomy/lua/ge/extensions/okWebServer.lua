local M = {}

local webserver = require('webserver')
local json = require('json')

local running = false
local data = {}

local function start()
  if running then return end
  webserver.init('127.0.0.1', 8099)
  running = true
end

local function stop()
  running = false
end

function M.setData(jsonStr)
  if type(jsonStr) ~= 'string' then return end
  local ok, decoded = pcall(json.decode, jsonStr)
  if ok and type(decoded) == 'table' then
    data = decoded
  end
end

local function handleClient(path)
  if path == 'data' then
    return json.encode(data or {})
  end
  return nil
end

local function update()
  if not running then return end
  webserver.update(handleClient)
end

M.start = start
M.stop = stop
M.update = update

return M

