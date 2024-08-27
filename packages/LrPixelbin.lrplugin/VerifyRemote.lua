local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"
local LrProgressScope = import "LrProgressScope"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("VerifyRemote")

Utils.runAsync(logger, "VerifyRemoteAsync", function(context)
  local goodPhotos = 0
  local badPhotos = 0
  local needsEdit = {}

  local services = LrApplication.activeCatalog():getPublishServices(_PLUGIN.id)
  local serviceCount = Utils.length(services)

  local parentScope = LrProgressScope({
    title = "Verifying Remote Media",
    functionContext = context,
  })
  parentScope:setCancelable(false)

  for idx, service in ipairs(services) do
    local collection = Utils.getDefaultCollection(service)
    parentScope:setPortionComplete(idx, serviceCount)

    local settings = service:getPublishSettings()
    logger:info("Checking photos for " .. settings.siteUrl)

    local photoIds = {}
    local publishedPhotos = {}
    local photosToCheck = 0

    for _, publishedPhoto in ipairs(collection:getPublishedPhotos()) do
      if publishedPhoto:getEditedFlag() then
        goodPhotos = goodPhotos + 1
      else
        local id = publishedPhoto:getRemoteId()

        if id then
          publishedPhotos[id] = publishedPhoto
          table.insert(photoIds, id)
          photosToCheck = photosToCheck + 1
          goodPhotos = goodPhotos + 1
        else
          logger:error("Found photo with missing remote ID.")
          table.insert(needsEdit, publishedPhoto)
          badPhotos = badPhotos + 1
        end
      end
    end

    if photosToCheck > 0 then
      local childScope = LrProgressScope({
        parent = parentScope,
        caption = "Checking photos for " .. settings.siteUrl,
        functionContext = context,
      })
      childScope:setCancelable(false)
      childScope:setPortionComplete(0, photosToCheck)

      local api = API(settings)
      local media = api:getMedia(photoIds, function(completed)
        childScope:setPortionComplete(completed, photosToCheck)
      end)

      for index, id in ipairs(photoIds) do
        if not media[id] then
          logger:error("Found photo with missing remote media.")
          goodPhotos = goodPhotos - 1
          badPhotos = badPhotos + 1
          table.insert(needsEdit, publishedPhotos[id])
        elseif not media[id].file then
          logger:error("Found unprocessed photo.")
          goodPhotos = goodPhotos - 1
          badPhotos = badPhotos + 1
          table.insert(needsEdit, publishedPhotos[id])
        end
      end

      childScope:done()
    end
  end

  parentScope:done()

  if badPhotos > 0 then
    Utils.runWithWriteAccess(logger, "UpdateEdited", function()
      for _, publishedPhoto in ipairs(needsEdit) do
        publishedPhoto:setEditedFlag(true)
      end
    end)
  end

  LrDialogs.message("Found " .. goodPhotos .. " good photos and " .. badPhotos .. " bad photos.", nil, "info")
end)
