local M = {}

local socket = require('socket.socket')
local json = require('json')

local server = nil
local clients = {}
local running = false
local data = {}

local function loadAppHtml()
  if M._cachedHtml then return M._cachedHtml end
  local try = {
    'ui/modules/apps/okFuelEconomy/app.html',
    'okFuelEconomy/ui/modules/apps/okFuelEconomy/app.html',
    'mods/unpacked/okFuelEconomy/ui/modules/apps/okFuelEconomy/app.html'
  }
  for _, p in ipairs(try) do
    local f = io.open(p, 'rb')
    if f then
      M._cachedHtml = f:read('*a')
      f:close()
      return M._cachedHtml
    end
  end
  M._cachedHtml = '<html><body>Fuel Economy endpoint</body></html>'
  return M._cachedHtml
end

local function start()
  if running then return end
  server = socket.tcp()
  if not server then
    log('E', 'okWebServer', 'failed to create tcp socket')
    return
  end
  local ok, err = server:bind('127.0.0.1', 8099)
  if not ok then
    log('E', 'okWebServer', 'bind failed: ' .. tostring(err))
    return
  end
  server:listen()
  server:settimeout(0)
  running = true
  log('I', 'okWebServer', 'listening on http://127.0.0.1:8099')
end

local function stop()
  if not running then return end
  for _, c in ipairs(clients) do c:close() end
  clients = {}
  if server then server:close() end
  server = nil
  running = false
  log('I', 'okWebServer', 'stopped')
end

function M.setData(jsonStr)
  if type(jsonStr) ~= 'string' then return end
  local ok, decoded = pcall(json.decode, jsonStr)
  if ok and type(decoded) == 'table' then
    data = decoded
    log('D', 'okWebServer', 'data updated')
  end
end

local function respond(c, body, contentType)
  local headers = 'HTTP/1.1 200 OK\r\nContent-Type: '..contentType..
                  '\r\nContent-Length: '..#body..'\r\n\r\n'
  c:send(headers..body)
end

local function handle(c, line)
  local path = line:match('GET%s+/(.-)%s+HTTP') or ''
  log('I', 'okWebServer', 'request for ' .. (path ~= '' and path or '/'))
  if path == '' or path == 'index.html' then
    respond(c, loadAppHtml(), 'text/html')
  elseif path == 'data' then
    respond(c, json.encode(data or {}), 'application/json')
  else
    local body = 'Not found'
    local headers = 'HTTP/1.1 404 Not Found\r\nContent-Length: '..#body..'\r\n\r\n'
    c:send(headers..body)
    log('W', 'okWebServer', '404 for ' .. path)
  end
end

local function update()
  if not running then return end

  while true do
    local client = server:accept()
    if not client then break end
    client:settimeout(0)
    table.insert(clients, client)
  end

  for i = #clients, 1, -1 do
    local c = clients[i]
    local line, err = c:receive()
    if line then
      handle(c, line)
      c:close()
      table.remove(clients, i)
    elseif err ~= 'timeout' then
      log('E', 'okWebServer', 'receive error: ' .. tostring(err))
      c:close()
      table.remove(clients, i)
    end
  end
end

M.start = start
M.stop = stop
M.update = update
M.onUpdate = update

return M

