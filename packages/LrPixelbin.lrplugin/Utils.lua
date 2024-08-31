local LrApplication = import "LrApplication"
local LrFunctionContext = import "LrFunctionContext"
local LrErrors = import "LrErrors"

local json = require "json"

local ERROR_CODES = {
  invalidUrl = "The Url is invalid",
  unknownHost = "Host not found: ^1",
  connection = "Connection failed: ^1",
  notLoggedIn = "Not logged in: ^1",
  tooLarge = "This file is too large.",
  notFound = "Resource not found.",
  backoff = "Server is overloaded, try again later.",
  unknown = "An unknown error occured.",
  badCredentials = "Incorrect username or password.",
  exiftoolError = "Exiftool returned an error.",
  badfile = "Failed opening Exiftool output: ^1",
  exception = "An exception was thrown: ^1",
  invalidJson = "Invalid JSON: ^1",
}

---@class Error
---@field code string
---@field args string[]
local Error = {}

---@class Utils
local Utils = {}

---@param code string
---@param args string[]?
---@return Error
function Utils.throw(code, args)
  local error = {
    code = code,
    args = args
  }

  setmetatable(error, { __index = Error })

  return error
end

---@generic T
---@param val T | Error
---@return boolean
function Utils.isSuccess(val)
  return not Utils.isError(val)
end

---@generic T
---@param val T | Error
---@return boolean
function Utils.isError(val)
  if type(val) ~= "table" then
    return false
  end

  local meta = getmetatable(val)
  return meta and meta["__index"] == Error
end

---@generic T
---@param val T | Error
---@return Error
function Utils.error(val)
  if Utils.isError(val) then
    return val
  end

  error("Unexpected error access on success")
end

---@generic T
---@param val T | Error
---@return string
function Utils.errorString(val)
  error = Utils.error(val)

  local message = "Unknown Error (" .. error.code .. ")"
  if ERROR_CODES[error.code] then
    message = ERROR_CODES[error.code]
  end

  return LOC("$$$/LrPixelBin/error/" .. error.code .. "=" .. message, unpack(val.args))
end

---@generic T
---@param val T | Error
---@return T
function Utils.result(val)
  if Utils.isSuccess(val) then
    return val
  end

  error("Unexpected result access on error")
end

---@param context LrFunctionContext
---@param logger Logger
---@param action string
function Utils.logFailures(context, logger, action)
  context:addFailureHandler(function(_, message)
    if LrErrors.isCanceledError(message) then
      logger:info(action, "User cancelled")
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
---@return T | Error
function Utils.safeCall(logger, action, func)
  ---@type boolean, any
  local success, result = LrFunctionContext.pcallWithContext(action, function(context)
    return func(context)
  end)

  if not success then
    if LrErrors.isCanceledError(result) then
      LrErrors.throwCanceled()
    end

    logger:error(action, result)
    return Utils.throw("exception", { result })
  end

  return result
end

---@param logger Logger
---@param table table
---@return string | Error
function Utils.jsonEncode(logger, table)
  local result = Utils.safeCall(logger, "json encode", function()
    return json.encode(table)
  end)

  if Utils.isError(result) then
    return Utils.throw("invalidJson", result.args)
  end

  return result
end

---@generic T
---@param logger Logger
---@param str string
---@return T | Error
function Utils.jsonDecode(logger, str)
  local result = Utils.safeCall(logger, "json decode", function()
    return json.decode(str)
  end)

  if Utils.isError(result) then
    return Utils.throw("invalidJson", result.args)
  end

  return result
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
---@return LrPublishedCollection[]
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

---@param publishService LrPublishService
---@return LrPublishedCollection[]
function Utils.listNonDefaultCollections(publishService)
  local collections = {}

  ---@param outer LrPublishService | LrPublishedCollectionSet
  local function list(outer)
    for _, collectionSet in ipairs(outer:getChildCollectionSets()) do
      list(collectionSet)
    end

    for _, collection in ipairs(outer:getChildCollections()) do
      local collectionInfo = collection:getCollectionInfoSummary()
      if not collectionInfo.isDefaultCollection then
        table.insert(collections, collection)
      end
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
