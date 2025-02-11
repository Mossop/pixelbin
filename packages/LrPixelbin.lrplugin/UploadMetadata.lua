local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"
local LrProgressScope = import "LrProgressScope"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("UploadMetadata")

---@param api API
---@param photo LrPhoto
---@param publishSettings PublishSettings
---@param remoteId string
---@param sourceId string
local function uploadMetadata(api, photo, publishSettings, remoteId, sourceId)
  local result = api:uploadMetadata(photo, publishSettings, remoteId, sourceId)
  if Utils.isError(result) then
    error(Utils.errorString(result))
  end
end

Utils.runAsync(logger, "UploadMetadata", function(context)
  LrDialogs.attachErrorDialogToFunctionContext(context)

  local remoteIdByLocalId = {}
  local totalPhotos = 0
  for _, photo in ipairs(LrApplication.activeCatalog():getTargetPhotos()) do
    remoteIdByLocalId[photo.localIdentifier] = "unknown"
    totalPhotos = totalPhotos + 1
  end

  local scope = LrProgressScope({
    title = "Uploading metadata",
    functionContext = context,
  })

  local count = 0
  scope:setPortionComplete(count, totalPhotos)

  for _, source in ipairs(LrApplication.activeCatalog():getActiveSources()) do
    if type(source) ~= "string" and source:type() == "LrPublishedCollection" then
      local service = source:getService()
      if service:getPluginId() == _PLUGIN.id then
        ---@type PublishSettings
        local settings = service:getPublishSettings()
        local api = API(settings)

        local defaultCollection = Utils.getDefaultCollection(service)
        local collectionInfo = defaultCollection:getCollectionInfoSummary()
        local sourceId = collectionInfo.collectionSettings.sourceId

        for _, published in ipairs(defaultCollection:getPublishedPhotos()) do
          local photo = published:getPhoto()
          if remoteIdByLocalId[photo.localIdentifier] then
            remoteIdByLocalId[photo.localIdentifier] = published:getRemoteId()
          end
        end

        for _, photo in ipairs(source:getPhotos()) do
          if scope:isCanceled() then
            return
          end

          if remoteIdByLocalId[photo.localIdentifier] then
            uploadMetadata(api, photo, settings, remoteIdByLocalId[photo.localIdentifier], sourceId)
            count = count + 1
            scope:setPortionComplete(count, totalPhotos)
          end
        end
      else
        LrDialogs.message("Can only re-upload metadata from a published collection for this service.", nil, "warning")
      end
    else
      LrDialogs.message("Can only re-upload metadata from a published collection for this service.", nil, "warning")
    end
  end

  scope:done()
end)
