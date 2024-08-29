local LrApplication = import "LrApplication"
local LrFunctionContext = import "LrFunctionContext"
local LrErrors = import "LrErrors"

local json = require "json"

---@class Utils
local Utils = {}

---@param context LrFunctionContext
---@param logger Logger
---@param action string
function Utils.logFailures(context, logger, action)
  context:addFailureHandler(function(_, message)
    if LrErrors.isCanceledError(message) then
      logger:info(action, message)
    else
      logger:error(action, message)
    end
  end)
end

---@param logger Logger
---@param action string
---@param func fun(context: LrFunctionContext)
function Utils.runWithWriteAccess(logger, action, func)
  local catalog = LrApplication.activeCatalog()

  if catalog.hasWriteAccess then
    Utils.safeCall(logger, action, func)
  else
    catalog:withWriteAccessDo(action, function(context)
      Utils.logFailures(context, logger, action)

      func(context)
    end)
  end
end

---@param logger Logger
---@param action string
---@param func fun(context: LrFunctionContext)
function Utils.runAsync(logger, action, func)
  LrFunctionContext.postAsyncTaskWithContext("init", function(context)
    Utils.logFailures(context, logger, action)

    func(context)
  end)
end

---@generic T
---@param logger Logger
---@param action string
---@param func fun(context: LrFunctionContext): T
---@return boolean, T
function Utils.safeCall(logger, action, func)
  local success, result = LrFunctionContext.pcallWithContext(action, function(context)
    return func(context)
  end)

  if not success then
    logger:error(action, result)
  end

  return success, result
end

---@param logger Logger
---@param table table
---@return boolean, any
function Utils.jsonEncode(logger, table)
  local success, str = Utils.safeCall(logger, "json encode", function()
    return json.encode(table)
  end)

  if not success then
    return false, {
      code = "invalidJson",
      name = str,
    }
  end

  return true, str
end

---@param logger Logger
---@param str string
---@return boolean, any
function Utils.jsonDecode(logger, str)
  local success, data = Utils.safeCall(logger, "json decode", function()
    return json.decode(str)
  end)

  if not success then
    return false, {
      code = "invalidJson",
      name = data,
    }
  end

  return true, data
end

---@param localId number
---@return LrPublishedCollection | LrPublishedCollectionSet
function Utils.getCollectionsForId(localId)
  local catalog = LrApplication.activeCatalog()
  return catalog:getPublishedCollectionByLocalIdentifier(localId)
end

--- @param publishService LrPublishService
--- @return LrPublishedCollection
function Utils.getDefaultCollection(publishService)
  for _, collection in ipairs(publishService:getChildCollections()) do
    local collectionInfo = collection:getCollectionInfoSummary()
    if collectionInfo.isDefaultCollection then
      return collection
    end
  end

  error("Default collection is missing")
end

---@param publishService LrPublishService
---@return (LrPublishedCollection|LrPublishedCollectionSet)[]
function Utils.listCollections(publishService)
  local collections = {}

  ---@param outer LrPublishService | LrPublishedCollectionSet
  local function list(outer)
    for _, collectionSet in ipairs(outer:getChildCollectionSets()) do
      list(collectionSet)
    end

    for _, collection in ipairs(outer:getChildCollections()) do
      table.insert(collections, collection)
    end
  end

  list(publishService)

  return collections
end

---@generic T
---@param tbl T
---@return T
function Utils.shallowClone(tbl)
  local result = {}
  for k, v in pairs(tbl) do
    result[k] = v
  end
  return result
end

---@param tbl table
---@return number
function Utils.length(tbl)
  local result = 0
  for _ in pairs(tbl) do
    result = result + 1
  end
  return result
end

return Utils
