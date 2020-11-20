local LrApplication = import "LrApplication"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("UploadMetadata")

local function uploadMetadata(photo, publishSettings, remoteId)
  local api = API(publishSettings)

  local success, result = api:uploadMetadata(photo, publishSettings, remoteId)
  if not success then
    error(result.name)
  end
end

Utils.runAsync(logger, "UploadMetadata", function()
  local photos = {}
  for _, photo in ipairs(LrApplication.activeCatalog():getTargetPhotos()) do
    photos[photo:getRawMetadata("uuid")] = true
  end

  for _, source in ipairs(LrApplication.activeCatalog():getActiveSources()) do
    if source:type() == "LrPublishedCollection" then
      local service = source:getService()
      if service:getPluginId() == _PLUGIN.id then
        local settings = service:getPublishSettings()

        local defaultCollection = Utils.getDefaultCollection(service)
        local publishedPhotos = {}
        for _, published in ipairs(defaultCollection:getPublishedPhotos()) do
          local photo = published:getPhoto()
          publishedPhotos[photo.localIdentifier] = published:getRemoteId()
        end

        for _, photo in ipairs(source:getPhotos()) do
          if photos[photo:getRawMetadata("uuid")] and publishedPhotos[photo.localIdentifier] then
            uploadMetadata(photo, settings, publishedPhotos[photo.localIdentifier])
          end
        end
      end
    end
  end
end)
