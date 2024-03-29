local LrApplication = import "LrApplication"
local LrFunctionContext = import "LrFunctionContext"
local LrErrors = import "LrErrors"

local json = require "json"

local Utils = { }

function Utils.logFailures(context, logger, action)
  context:addFailureHandler(function(_, message)
    if LrErrors.isCanceledError(message) then
      logger:info(action, message)
    else
      logger:error(action, message)
    end
  end)
end

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

function Utils.runAsync(logger, action, func)
  LrFunctionContext.postAsyncTaskWithContext("init", function(context)
    Utils.logFailures(context, logger, action)

    func(context)
  end)
end

function Utils.safeCall(logger, action, func)
  local success, result = LrFunctionContext.pcallWithContext(action, function(context)
    return func()
  end)

  if not success then
    logger:error(action, result)
  end

  return success, result
end

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

function Utils.jsonDecode(logger, str)
  local success, data =  Utils.safeCall(logger, "json decode", function()
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

function Utils.getCollectionsForId(localId)
  local catalog = LrApplication.activeCatalog()
  return catalog:getPublishedCollectionByLocalIdentifier(localId)
end

function Utils.getDefaultCollection(publishService)
  for _, collection in ipairs(publishService:getChildCollections()) do
    local collectionInfo = collection:getCollectionInfoSummary()
    if collectionInfo.isDefaultCollection then
      return collection
    end
  end

  return nil
end

function Utils.shallowClone(tbl)
  local result = {}
  for k, v in pairs(tbl) do
    result[k] = v
  end
  return result
end

return Utils
