local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("VerifyRemote")

Utils.runAsync(logger, "VerifyRemoteAsync", function()
  local goodPhotos = 0
  local badPhotos = 0
  local needsEdit = {}

  local services = LrApplication.activeCatalog():getPublishServices(_PLUGIN.id)
  for _, service in ipairs(services) do
    local collection = Utils.getDefaultCollection(service)
    local settings = service:getPublishSettings()
    logger:info("Checking photos for " .. settings.siteUrl)

    local needsRemoteCheck = false
    local photoIds = {}
    local publishedPhotos = {}
    for _, publishedPhoto in ipairs(collection:getPublishedPhotos()) do
      if publishedPhoto:getEditedFlag() then
        goodPhotos = goodPhotos + 1
      else
        local id = publishedPhoto:getRemoteId()

        if id then
          publishedPhotos[id] = publishedPhoto
          table.insert(photoIds, id)
          goodPhotos = goodPhotos + 1
          needsRemoteCheck = true
        else
          logger:error("Found photo with missing remote ID.")
          table.insert(needsEdit, publishedPhoto)
          badPhotos = badPhotos + 1
        end
      end
    end

    if needsRemoteCheck then
      local api = API(settings)
      local media = api:getMedia(photoIds)
      for index, id in ipairs(photoIds) do
        if not media[index] then
          logger:error("Found photo with missing remote media.")
          goodPhotos = goodPhotos - 1
          badPhotos = badPhotos + 1
          table.insert(needsEdit, publishedPhotos[id])
        elseif not media[index].file then
          logger:error("Found unprocessed photo.")
          goodPhotos = goodPhotos - 1
          badPhotos = badPhotos + 1
          table.insert(needsEdit, publishedPhotos[id])
        end
      end
    end
  end

  if badPhotos > 0 then
    Utils.runWithWriteAccess(logger, "UpdateEdited", function()
      for _, publishedPhoto in ipairs(needsEdit) do
        publishedPhoto:setEditedFlag(true)
      end
    end)
  end

  LrDialogs.message("Found " .. goodPhotos .. " good photos and " .. badPhotos .. " bad photos.", nil, "info")
end)
