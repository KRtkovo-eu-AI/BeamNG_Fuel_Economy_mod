local M = {}

local paused

local function setPaused(state)
  if state ~= paused then
    paused = state
    log('I', 'okGameState', state and 'Game paused' or 'Game resumed')
  end
end

local function getState()
  return { paused = paused }
end

M.onExtensionLoaded = function()
  if streams and streams.registerStream then
    streams.registerStream('okGameState', getState)
  end
  if be and be.getPlayState then
    setPaused(be:getPlayState() ~= 1)
  else
    setPaused(false)
  end
end

M.onPhysicsPaused = function()
  setPaused(true)
end

M.onPhysicsUnpaused = function()
  setPaused(false)
end

return M
