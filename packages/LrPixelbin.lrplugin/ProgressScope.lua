local LrTasks = import "LrTasks"
local LrProgressScope = import "LrProgressScope"
local LrFunctionContext = import "LrFunctionContext"
local LrErrors = import "LrErrors"

local Utils = require "Utils"

local logger = require("Logging")("ProgressScope")

---@class ProgressScope
---@field protected current number
---@field protected total number
---@field protected updateChildPosition fun(self: ProgressScope, position: number, noyield: boolean?)
---@field advance fun(self: ProgressScope, count: number?, noyield: boolean?)
---@field isCanceled fun(self: ProgressScope): boolean
local ProgressScope = {}

---@class InnerProgressScope : ProgressScope
---@field private parent ProgressScope
local InnerProgressScope = {}

setmetatable(InnerProgressScope, { __index = ProgressScope })

---@class RootProgressScope : ProgressScope
---@field private scope LrProgressScope
local RootProgressScope = {}

setmetatable(RootProgressScope, { __index = ProgressScope })

---@param count number?
function ProgressScope:advance(count)
  if count == nil then
    count = 1
  end

  self.current = self.current + count

  if self.current > self.total then
    logger:warn("Advanced past total", self.current, self.total)
    self.current = self.total
  end
end

---@generic T
---@param tbl T[]
---@param func fun(scope: ProgressScope, index: number, item: T)
function ProgressScope:ipairs(tbl, func)
  self:childScope(Utils.length(tbl), function(scope)
    for idx, item in ipairs(tbl) do
      func(scope, idx, item)

      scope:advance()
    end
  end)
end

---@generic T
---@param total number
---@param func fun(scope: ProgressScope): T | nil
---@return T
function ProgressScope:childScope(total, func)
  local scope = InnerProgressScope.new(self, total)
  local result = func(scope)
  self:advance()
  return result
end

---@param parent ProgressScope
---@param total number
---@return InnerProgressScope
function InnerProgressScope.new(parent, total)
  ---@type InnerProgressScope
  local progressScope = {
    parent = parent,
    current = 0,
    total = total,
  }
  setmetatable(progressScope, { __index = InnerProgressScope })

  return progressScope
end

---@param count number?
---@param noyield boolean?
function InnerProgressScope:advance(count, noyield)
  ProgressScope.advance(self, count)

  self.parent:updateChildPosition(self.current / self.total, noyield)
end

---@param position number
---@param noyield boolean?
function InnerProgressScope:updateChildPosition(position, noyield)
  self.parent:updateChildPosition((self.current + position) / self.total, noyield)
end

---@return boolean
function InnerProgressScope:isCanceled()
  return self.parent:isCanceled()
end

---@param scope LrProgressScope
---@param total number
---@return RootProgressScope
function RootProgressScope.new(scope, total)
  ---@type RootProgressScope
  local progressScope = {
    scope = scope,
    current = 0,
    total = total,
  }
  setmetatable(progressScope, { __index = RootProgressScope })

  return progressScope
end

---@private
---@param position number
---@param noyield boolean?
function RootProgressScope:setPosition(position, noyield)
  self.scope:setPortionComplete(position, 1)

  if not noyield and LrTasks.canYield() then
    LrTasks.yield()
  end

  if self.scope:isCanceled() then
    LrErrors.throwCanceled()
  end
end

---@param position number
---@param noyield boolean?
function RootProgressScope:updateChildPosition(position, noyield)
  self:setPosition((self.current + position) / self.total, noyield)
end

---@param count number?
---@param noyield boolean?
function RootProgressScope:advance(count, noyield)
  ProgressScope.advance(self, count)

  self:setPosition(self.current / self.total, noyield)
end

---@return boolean
function RootProgressScope:isCanceled()
  return self.scope:isCanceled()
end

---@generic T
---@param title string
---@param total number
---@param func fun(scope: ProgressScope, functionContext: LrFunctionContext): T | nil
---@return T
function ProgressScope.new(title, total, func)
  local success, result = LrFunctionContext.pcallWithContext(title, function(context)
    local scope = LrProgressScope({
      title = title,
      functionContext = context,
    })
    scope:setCancelable(true)

    local rootScope = RootProgressScope.new(scope, total)

    return func(rootScope, context)
  end)

  if not success then
    error(result)
  else
    return result
  end
end

---@generic T
---@param title string
---@param total number
---@param exportContext LrExportContext
---@param func fun(scope: ProgressScope): T | nil
---@return T
function ProgressScope.forExportContext(title, total, exportContext, func)
  local scope = exportContext:configureProgress({
    title = title,
  })
  scope:setCancelable(true)

  local rootScope = RootProgressScope.new(scope, total)
  return func(rootScope)
end

return ProgressScope
