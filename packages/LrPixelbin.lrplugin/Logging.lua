local LrLogger = import "LrLogger"

local lrLogger = LrLogger("PixelBin")
lrLogger:enable("logfile")

---@class Logger
---@field name string
local Logger = {}

---@param ... any
function Logger:trace(...)
  lrLogger:trace(self.name, unpack(arg))
end

---@param ... any
function Logger:debug(...)
  lrLogger:debug(self.name, unpack(arg))
end

---@param ... any
function Logger:info(...)
  lrLogger:info(self.name, unpack(arg))
end

---@param ... any
function Logger:warn(...)
  lrLogger:warn(self.name, unpack(arg))
end

---@param ... any
function Logger:error(...)
  lrLogger:error(self.name, unpack(arg))
end

---@param name string
---@return Logger
local function create(name)
  local logger = { name = name }
  setmetatable(logger, { __index = Logger })
  return logger
end

return create
