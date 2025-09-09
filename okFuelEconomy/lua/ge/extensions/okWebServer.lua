local M = {}

local socket = require('socket.socket')
local json = require('json')

local server = nil
local clients = {}
local running = false
local dataStr = '{}'
local listenPort = 23512

local uiHtml = [[
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Fuel Economy</title>
<style>
body{font-family:Segoe UI,Tahoma,sans-serif;margin:0;padding:8px;}
body.custom{padding:4px;border-radius:10px;background-color:rgba(10,15,20,0.75);background-image:linear-gradient(rgba(0,200,255,0.05) 1px,transparent 1px),linear-gradient(90deg, rgba(0,200,255,0.05) 1px,transparent 1px);background-size:16px 16px,16px 16px;color:#aeeaff;letter-spacing:0.3px;box-shadow:inset 0 0 10px rgba(0,200,255,0.25);}
table{width:100%;border-collapse:collapse;font-size:0.85em;}
td{padding:3px 2px;}
body.custom td{border-bottom:1px solid rgba(0,180,255,0.1);}
td:first-child{width:38%;font-weight:500;}
body.custom td:first-child{color:#69e0ff;text-shadow:0 0 3px rgba(0,255,255,0.4);}
body.custom tr.trip td:first-child{color:#ffa64d;}
body.custom tr.trip td:nth-child(2){color:#FFE7CC;}
</style>
</head>
<body>
<strong id="heading"></strong>
<table id="dataRows"></table>
<script>
const ROWS={
"row-distance":{label:"Traveled distance",fields:[{key:"distanceMeasured",label:"Measured"},{key:"distanceEcu",label:"From ECU"}]},
"row-fuel":{label:"Fuel",fields:[{key:"fuelUsed",label:"Used"},{key:"fuelLeft",label:"Left"},{key:"fuelCap",label:"Capacity"}]},
"row-fuelType":{label:"Fuel type",fields:[{key:"fuelType",label:""}]},
"row-costPrice":{label:"Fuel price",fields:[{key:"costPrice",label:""}]},
"row-totalCost":{label:"Total fuel cost",fields:[{key:"totalCost",label:""}]},
"row-instantConsumption":{label:"Instant consumption",fields:[{key:"instantLph",label:""},{key:"instantL100km",label:""},{key:"instantKmL",label:""}]},
"row-instantCO2":{label:"Instant CO₂ emissions",fields:[{key:"instantCO2",label:""}]},
"row-averageConsumption":{label:"Average consumption",fields:[{key:"avgL100km",label:""},{key:"avgKmL",label:""}]},
"row-averageCost":{label:"Average fuel cost",fields:[{key:"avgCost",label:""}]},
"row-averageCO2":{label:"Average CO₂ emissions",fields:[{key:"avgCO2",label:""}]},
"row-range":{label:"Range",fields:[{key:"range",label:""}]},
"row-tripDistance":{label:"Trip distance",fields:[{key:"tripDistance",label:""}]},
"row-tripFuelUsed":{label:"Trip fuel used",fields:[{key:"tripFuelUsedLiquid",label:"Liquid"},{key:"tripFuelUsedElectric",label:"Electric"}]},
"row-tripTotalCost":{label:"Trip total fuel cost",fields:[{key:"tripTotalCostLiquid",label:"Liquid"},{key:"tripTotalCostElectric",label:"Electric"}]},
"row-tripTotalCO2":{label:"Trip total CO₂ emissions",fields:[{key:"tripTotalCO2",label:""}]},
"row-tripTotalNOx":{label:"Trip total NOₓ emissions",fields:[{key:"tripTotalNOx",label:""}]},
"row-tripAvgConsumption":{label:"Trip average consumption",fields:[{key:"tripAvgL100km",label:""},{key:"tripAvgKmL",label:""}]},
"row-tripRange":{label:"Trip range",fields:[{key:"tripRange",label:""}]},
"row-tripAvgCost":{label:"Trip average fuel cost",fields:[{key:"tripAvgCostLiquid",label:"Liquid"},{key:"tripAvgCostElectric",label:"Electric"}]},
"row-tripAvgCO2":{label:"Trip average CO₂ emissions",fields:[{key:"tripAvgCO2",label:""}]}
};
function buildRows(s){
const tbody=document.getElementById('dataRows');tbody.innerHTML='';
const order=[...(new Set([...(s.rowOrder||[]),...Object.keys(ROWS)]))];
order.forEach(id=>{
const r=ROWS[id];if(!r)return;
if(!r.fields.some(f=>!s.visible||s.visible[f.key]!==false))return;
const tr=document.createElement('tr');tr.id=id; if(id.startsWith('row-trip')) tr.className='trip';
const td1=document.createElement('td');td1.textContent=r.label;tr.appendChild(td1);
const td2=document.createElement('td');
r.fields.forEach((f,i)=>{
 if(!s.visible||s.visible[f.key]!==false){
   const container=document.createElement('span');
   if(f.label){container.appendChild(document.createTextNode(f.label+': '));}
   const span=document.createElement('span');span.id=f.key;container.appendChild(span);
   td2.appendChild(container);
   if(i<r.fields.length-1)td2.appendChild(document.createTextNode(' | '));
 }
});
tr.appendChild(td2);tbody.appendChild(tr);
});
}
let lastOrder='',lastVisible='';
async function refresh(){
const res=await fetch('data.json');const state=await res.json();const s=state.settings||{};
document.body.className=s.useCustomStyles?'custom':'';
const heading=document.getElementById('heading');
heading.style.display=(s.visible&&s.visible.heading===false)?'none':'';
heading.textContent='Fuel Economy'+(state.gameStatus==='paused'?' (game paused)':'')+(state.vehicleName?' - '+state.vehicleName:'');
const orderJson=JSON.stringify(s.rowOrder||[]);
const visibleJson=JSON.stringify(s.visible||{});
if(orderJson!==lastOrder||visibleJson!==lastVisible){buildRows(s);lastOrder=orderJson;lastVisible=visibleJson;}
Object.keys(state).forEach(k=>{
if(k==='settings')return;
const el=document.getElementById(k);
if(!el)return;
const v=state[k];
if(v&&typeof v==='object'&&v.value!=null){
 let text=v.value+(v.unit?' '+v.unit:'');
 if(k==='avgCO2'&&state.avgCo2Class){text+=' | '+state.avgCo2Class;}
 if(k==='tripAvgCO2'&&state.tripCo2Class){text+=' | '+state.tripCo2Class;}
 el.textContent=text;
}
else if(typeof v==='string'){el.textContent=v;}
});
}
refresh();setInterval(refresh,1000);
</script>
</body>
</html>
]]

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

local function respondJson(c, body)
  local headers = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ' .. #body .. '\r\n\r\n'
  c:send(headers .. body)
end

local function respondHtml(c, body)
  local headers = 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: ' .. #body .. '\r\n\r\n'
  c:send(headers .. body)
end

local function handle(c, line)
  local path = line:match('GET%s+/(.-)%s+HTTP') or ''
  log('I', 'okWebServer', 'request for ' .. (path ~= '' and path or '/'))
  if path == 'ui.html' then
    respondHtml(c, uiHtml)
  else
    respondJson(c, dataStr)
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

function M.getPort()
  return running and listenPort or nil
end

return M

