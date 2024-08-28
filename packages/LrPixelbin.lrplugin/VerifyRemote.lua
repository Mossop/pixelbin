local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"
local LrProgressScope = import "LrProgressScope"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("VerifyRemote")

Utils.runAsync(logger, "VerifyRemoteAsync", function(context)
  local needsEdit = {}

  local services = LrApplication.activeCatalog():getPublishServices(_PLUGIN.id)
  local serviceCount = Utils.length(services)

  local parentScope = LrProgressScope({
    title = "Verifying Remote Media",
    functionContext = context,
  })
  parentScope:setCancelable(false)

  for idx, service in ipairs(services) do
    local defaultCollection = Utils.getDefaultCollection(service)
    parentScope:setPortionComplete(idx, serviceCount)

    local publishSettings = service:getPublishSettings()
    local catalog = publishSettings.catalog
    logger:info("Checking photos for " .. publishSettings.siteUrl)

    local remoteIds = {}
    local byRemoteId = {}
    local byLocalId = {}

    for _, publishedPhoto in ipairs(defaultCollection:getPublishedPhotos()) do
      byLocalId[publishedPhotos:getPhoto().localIdentifier] = publishedPhoto
    end

    local toAdd = {}

    local collections = Utils.listCollections(service)
    for _, collection in ipairs(collections) do
      if collection ~= defaultCollection then
        for _, publishedPhoto in ipairs(collection:getPublishedPhotos()) do
          local remoteId = publishedPhoto:getRemoteId()

          if not remoteId then
            -- Never published. Just make sure it is marked to be published
            if not publishedPhoto:getEditedFlag() then
              table.insert(needsEdit, publishedPhoto)
            end
          elseif not byLocalId[publishedPhoto:getPhoto().localIdentifier] then
            -- Photo is not in the default collection when it should be
            local mediaItem = nil

            local itemToAdd = toAdd[publishedPhoto:getPhoto().localIdentifier]
            if not itemToAdd then
              itemToAdd = {
                photo = publishedPhoto:getPhoto(),
                edited = publishedPhoto:getEditedFlag(),
                mediaItem = nil
              }
              toAdd[publishedPhoto:getPhoto().localIdentifier] = itemToAdd
            elseif publishedPhoto:getEditedFlag() then
              itemToAdd.edited = true
            end

            local startIndex, _ = string.find(remoteId, "/")
            if startIndex then
              itemToAdd.mediaItem = string.sub(remoteId, startIndex + 1)
            elseif not publishedPhoto:getEditedFlag() then
              -- Unexpected remote Id. Republish.
              table.insert(needsEdit, publishedPhoto)
            end
          end
        end
      end
    end

    Utils.runWithWriteAccess(logger, "Add Photo to Catalog", function()
      for _, itemToAdd in pairs(toAdd) do
        if itemToAdd.mediaItem then
          local catalogUrl = publishSettings.siteUrl .. "catalog/" .. catalog .. "/media/" .. itemToAdd.mediaItem
          defaultCollection:addPhotoByRemoteId(itemToAdd.photo, itemToAdd.mediaItem, catalogUrl, itemToAdd.edited)
        end
      end
    end)

    local photosToCheck = 0

    for _, publishedPhoto in ipairs(defaultCollection:getPublishedPhotos()) do
      byLocalId[publishedPhotos:getPhoto().localIdentifier] = publishedPhoto
      local remoteId = publishedPhoto:getRemoteId()

      if remoteId then
        byRemoteId[remoteId] = publishedPhoto
        table.insert(remoteIds, remoteId)
        photosToCheck = photosToCheck + 1
      elseif not publishedPhoto:getEditedFlag() then
        logger:error("Found photo with missing remote ID.")
        table.insert(needsEdit, publishedPhoto)
      end
    end

    if photosToCheck > 0 then
      local childScope = LrProgressScope({
        parent = parentScope,
        caption = "Downloading photos for " .. publishSettings.siteUrl,
        functionContext = context,
      })
      childScope:setCancelable(false)
      childScope:setPortionComplete(0, photosToCheck)

      local api = API(publishSettings)
      local media = api:getMedia(remoteIds, function(completed)
        childScope:setPortionComplete(completed, photosToCheck)
      end)

      childScope:done()

      for _, id in ipairs(remoteIds) do
        if not media[id] then
          logger:error("Found photo with missing remote media.")
          table.insert(needsEdit, byRemoteId[id])
        elseif not media[id].file then
          logger:error("Found unprocessed photo.")
          table.insert(needsEdit, byRemoteId[id])
        end
      end
    end
  end

  parentScope:done()

  local editCount = Utils.length(needsEdit)

  if editCount > 0 then
    Utils.runWithWriteAccess(logger, "Mark to republish", function()
      for _, publishedPhoto in ipairs(needsEdit) do
        publishedPhoto:setEditedFlag(true)
      end
    end)
  end

  LrDialogs.message("Marked " .. editCount .. " photos to be republished.", nil, "info")
end)
