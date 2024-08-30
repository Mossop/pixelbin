local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"
local LrProgressScope = import "LrProgressScope"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("UploadMetadata")

---@param photo LrPhoto
---@param publishSettings PublishSettings
---@param remoteId string
local function uploadMetadata(photo, publishSettings, remoteId)
  local api = API(publishSettings)

  local result = api:uploadMetadata(photo, publishSettings, remoteId)
  if Utils.isError(result) then
    error(Utils.errorString(result))
  end
end

Utils.runAsync(logger, "UploadMetadata", function(context)
  LrDialogs.attachErrorDialogToFunctionContext(context)

  local photos = {}
  local totalPhotos = 0
  for _, photo in ipairs(LrApplication.activeCatalog():getTargetPhotos()) do
    photos[photo:getRawMetadata("uuid")] = true
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

        local defaultCollection = Utils.getDefaultCollection(service)
        local publishedPhotos = {}
        for _, published in ipairs(defaultCollection:getPublishedPhotos()) do
          local photo = published:getPhoto()
          publishedPhotos[photo.localIdentifier] = published:getRemoteId()
        end

        for _, photo in ipairs(source:getPhotos()) do
          if scope:isCanceled() then
            return
          end

          if photos[photo:getRawMetadata("uuid")] and publishedPhotos[photo.localIdentifier] then
            uploadMetadata(photo, settings, publishedPhotos[photo.localIdentifier])
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
