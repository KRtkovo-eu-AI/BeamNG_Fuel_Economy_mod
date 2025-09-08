local M = {}

local lastPaused

local function isPaused()
  -- be:getPlayState is not available in all environments, so guard against
  -- calling a nil method which would raise a Lua error inside the game
  if be and be.getPlayState then
    return be:getPlayState() ~= 1
  end
  return false
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
