local M = {}

local socket = require('socket.socket')
local json = require('json')

local server = nil
local clients = {}
local running = false
local dataStr = '{}'
local listenPort = 23512

local function start()
  if running then return end

  server = socket.tcp()
  if not server then
    log('E', 'okWebServer', 'failed to create tcp socket')
    return
  end

  server:setoption('reuseaddr', true)
  local ok, err = server:bind('127.0.0.1', listenPort)
  if not ok then
    ok, err = server:bind('0.0.0.0', listenPort)
  end
  if not ok then
    log('E', 'okWebServer', 'bind failed on port ' .. listenPort .. ': ' .. tostring(err))
    server:close()
    server = nil
    return
  end

  server:listen()
  server:settimeout(0)
  running = true
  log('I', 'okWebServer', 'listening on http://127.0.0.1:' .. listenPort)
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
  local ok = pcall(json.decode, jsonStr)
  if ok then
    dataStr = jsonStr
    log('D', 'okWebServer', 'data updated')
  end
end

local function respond(c, body)
  local headers = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ' .. #body .. '\r\n\r\n'
  c:send(headers .. body)
end

local function handle(c, line)
  local path = line:match('GET%s+/(.-)%s+HTTP') or ''
  log('I', 'okWebServer', 'request for ' .. (path ~= '' and path or '/'))
  respond(c, dataStr)
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

function M.getPort()
  return running and listenPort or nil
end

return M

