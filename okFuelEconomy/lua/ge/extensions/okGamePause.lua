local M = {}

local function onGamePaused()
  guihooks.trigger('GamePaused')
end

local function onGameResumed()
  guihooks.trigger('GameResumed')
end

M.onGamePaused = onGamePaused
M.onGameResumed = onGameResumed

return M
