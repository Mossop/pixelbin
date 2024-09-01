local LrTasks = import "LrTasks"
local LrProgressScope = import "LrProgressScope"
local LrFunctionContext = import "LrFunctionContext"
local LrErrors = import "LrErrors"

local Utils = require "Utils"

local logger = require("Logging")("ProgressScope")

---@class ProgressScope
---@field private inChild boolean
---@field protected current number
---@field protected total number
---@field protected depth fun(self: ProgressScope): number
---@field protected updateChildPosition fun(self: ProgressScope, position: number, noYield: boolean?)
---@field advance fun(self: ProgressScope, count: number?, noYield: boolean?)
---@field updatePosition fun(self: ProgressScope, noYield: boolean?)
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
  if self.inChild then
    logger:warn("Advancing parent scope with active child", self:depth(), self.current, self.total)
  end

  if self.current > target then
    logger:warn("Reversed progress", self:depth(), self.current, self.total, target)
  end

  self.current = target

  if self.current > self.total then
    logger:warn("Advanced past total", self:depth(), self.current, self.total)
  end

  self:updatePosition(noYield)
end

---@generic A, B, C, D, E
---@param inner fun(state, var): A, B, C, D, E
---@return fun(): A, B, C, D, E
function ProgressScope:iter(inner, state, var)
  ---@return any[]
  local function asTable(...)
    return arg
  end

  local target = self.current

  local function iter()
    self:advanceTo(target)
    target = self.current + 1

    local vars = asTable(inner(state, var))
    var = vars[1]
    if var ~= nil then
      return unpack(vars)
    else
      return nil
    end
  end

  return iter
end

---@generic T
---@param tbl T[]
---@param func fun(scope: ProgressScope, index: number, item: T)
function ProgressScope:ipairs(tbl, func)
  self:childScope(Utils.length(tbl), function(scope)
    for idx, item in scope:iter(ipairs(tbl)) do
      func(scope, idx, item)
    end
  end)
end

---@generic T
---@param total number
---@param func fun(scope: ProgressScope): T | nil
---@return T
function ProgressScope:childScope(total, func)
  local scope = InnerProgressScope.new(self, total)
  scope:updatePosition(true)

  local target = self.current + 1
  self.inChild = true
  local result = func(scope)
  self.inChild = false

  if scope.current ~= scope.total then
    logger:warn("Scope ended before completing", scope:depth(), scope.current, scope.total)
  end

  self.current = target
  self:updatePosition()

  return result
end

---@param parent ProgressScope
---@param total number
---@return InnerProgressScope
function InnerProgressScope.new(parent, total)
  ---@type InnerProgressScope
  local progressScope = {
    parent = parent,
    inChild = false,
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
function InnerProgressScope:updatePosition(noYield)
  self.parent:updateChildPosition(math.min(self.total, self.current) / self.total, noYield)
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
    inChild = false,
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
function RootProgressScope:updatePosition(noYield)
  self:setPosition(math.min(self.total, self.current) / self.total, noYield)
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
