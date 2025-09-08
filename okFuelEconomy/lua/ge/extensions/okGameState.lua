local M = {}

local function getState()
  return { paused = be:getPlayState() ~= 1 }
end

M.onInit = function()
  if streams and streams.registerStream then
    streams.registerStream('okGameState', getState)
  end
end

return M
