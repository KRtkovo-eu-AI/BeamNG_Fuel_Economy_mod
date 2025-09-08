local M = {}

local lastPaused

local function isPaused()
  return be:getPlayState() ~= 1
end

local function logIfChanged(paused)
  if paused ~= lastPaused then
    lastPaused = paused
    log('I', 'okGameState', paused and 'Game paused' or 'Game resumed')
  end
end

local function getState()
  return { paused = isPaused() }
end

local function checkPaused()
  logIfChanged(isPaused())
end

M.onInit = function()
  if streams and streams.registerStream then
    streams.registerStream('okGameState', getState)
  end
  checkPaused()
end

M.onUpdate = checkPaused

return M
