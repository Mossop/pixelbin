local LrTasks = import "LrTasks"
local LrProgressScope = import "LrProgressScope"
local LrFunctionContext = import "LrFunctionContext"
local LrErrors = import "LrErrors"

local Utils = require "Utils"

local logger = require("Logging")("ProgressScope")

---@class ProgressScope
---@field protected current number
---@field protected total number
---@field protected depth fun(self: ProgressScope): number
---@field protected updateChildPosition fun(self: ProgressScope, position: number, noYield: boolean?)
---@field advance fun(self: ProgressScope, count: number?, noYield: boolean?)
---@field afterAdvance fun(self: ProgressScope, noYield: boolean?)
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
---@param noYield boolean?
function ProgressScope:advance(count, noYield)
  if count == nil then
    count = 1
  end

  self:advanceTo(self.current + count, noYield)
end

---@param target number
---@param noYield boolean?
function ProgressScope:advanceTo(target, noYield)
  self.current = target

  if self.current > self.total then
    logger:warn("Advanced past total", self:depth(), self.current, self.total)
    self.current = self.total
  end

  self:afterAdvance(noYield)
end

---@generic T
---@param tbl T[]
---@param func fun(scope: ProgressScope, index: number, item: T)
function ProgressScope:ipairs(tbl, func)
  self:childScope(Utils.length(tbl), function(scope)
    local target = 0
    for idx, item in ipairs(tbl) do
      target = target + 1
      func(scope, idx, item)

      scope:advanceTo(target)
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
  local target = self.current + 1

  if scope.current ~= scope.total then
    logger:warn("Scope ended before completing", scope:depth(), scope.current, scope.total)
  end

  self.current = target
  self:afterAdvance()

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

---@return number
function InnerProgressScope:depth()
  return self.parent:depth() + 1
end

---@param noYield boolean?
function InnerProgressScope:afterAdvance(noYield)
  self.parent:updateChildPosition(self.current / self.total, noYield)
end

---@param position number
---@param noYield boolean?
function InnerProgressScope:updateChildPosition(position, noYield)
  self.parent:updateChildPosition((self.current + position) / self.total, noYield)
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

---@return number
function RootProgressScope:depth()
  return 0
end

---@private
---@param position number
---@param noYield boolean?
function RootProgressScope:setPosition(position, noYield)
  self.scope:setPortionComplete(position, 1)

  if not noYield and LrTasks.canYield() then
    LrTasks.yield()
  end

  if self.scope:isCanceled() then
    LrErrors.throwCanceled()
  end
end

---@param position number
---@param noYield boolean?
function RootProgressScope:updateChildPosition(position, noYield)
  self:setPosition((self.current + position) / self.total, noYield)
end

---@param noYield boolean?
function RootProgressScope:afterAdvance(noYield)
  self:setPosition(self.current / self.total, noYield)
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
