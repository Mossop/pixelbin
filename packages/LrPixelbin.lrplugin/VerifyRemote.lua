local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"
local LrProgressScope = import "LrProgressScope"
local LrTasks = import "LrTasks"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("VerifyRemote")

PROGRESS_SECTIONS = 5

Utils.runAsync(logger, "VerifyRemoteAsync", function(context)
  ---@type LrPublishedPhoto[]
  local needsEdit = {}

  local services = LrApplication.activeCatalog():getPublishServices(_PLUGIN.id)

  for _, service in ipairs(services) do
    local defaultCollection = Utils.getDefaultCollection(service)

    ---@type PublishSettings
    local publishSettings = service:getPublishSettings()
    local catalog = publishSettings.catalog
    logger:info("Checking photos for " .. publishSettings.siteUrl)

    logger:info("Service start")

    ---@type string[]
    local remoteIds = {}
    ---@type { [string]: LrPublishedPhoto }
    local byRemoteId = {}
    ---@type { [number]: LrPublishedPhoto }
    local byLocalId = {}

    --- First loop over default collection
    for _, publishedPhoto in ipairs(defaultCollection:getPublishedPhotos()) do
      byLocalId[publishedPhoto:getPhoto().localIdentifier] = publishedPhoto
    end

    ---@type { [number]: { photo: LrPhoto, edited: boolean, mediaItem: string | nil } }
    local toAdd = {}

    local collections = Utils.listCollections(service)
    for _, collection in ipairs(collections) do
      if collection ~= defaultCollection then
        logger:info("Collection start")
        for _, publishedPhoto in ipairs(collection:getPublishedPhotos()) do
          local remoteId = publishedPhoto:getRemoteId()

          if not remoteId then
            -- Never published. Just make sure it is marked to be published
            if not publishedPhoto:getEditedFlag() then
              table.insert(needsEdit, publishedPhoto)
            end
          elseif not byLocalId[publishedPhoto:getPhoto().localIdentifier] then
            -- Photo is not in the default collection when it should be
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

          LrTasks.yield()
        end
        logger:info("Collection end")
      end
    end

    Utils.runWithWriteAccess(logger, "Add Photo to Catalog", function()
      for _, itemToAdd in pairs(toAdd) do
        if itemToAdd.mediaItem then
          local catalogUrl = publishSettings.siteUrl .. "catalog/" .. catalog .. "/media/" .. itemToAdd.mediaItem
          defaultCollection:addPhotoByRemoteId(itemToAdd.photo, itemToAdd.mediaItem, catalogUrl, not itemToAdd.edited)

          LrTasks.yield()
        end
      end
    end)

    local photosToCheck = 0

    logger:info("Default collection start")
    for _, publishedPhoto in ipairs(defaultCollection:getPublishedPhotos()) do
      byLocalId[publishedPhoto:getPhoto().localIdentifier] = publishedPhoto
      local remoteId = publishedPhoto:getRemoteId()

      if remoteId then
        byRemoteId[remoteId] = publishedPhoto
        table.insert(remoteIds, remoteId)
        photosToCheck = photosToCheck + 1
      elseif not publishedPhoto:getEditedFlag() then
        logger:error("Found photo with missing remote ID.")
        table.insert(needsEdit, publishedPhoto)
      end

      LrTasks.yield()
    end
    logger:info("Default collection end")

    if photosToCheck > 0 then
      local api = API(publishSettings)
      api:refreshState()

      logger:info("Get " .. photosToCheck .. " media")
      local lastCompleted = 0
      local media = api:getMedia(remoteIds, function(completed)
      end)
      logger:info("Got media")


      for _, id in ipairs(remoteIds) do
        if not byRemoteId[id]:getEditedFlag() then
          if not media[id] then
            logger:error("Found photo with missing remote media.")
            table.insert(needsEdit, byRemoteId[id])
          elseif not media[id].file then
            logger:error("Found unprocessed photo.")
            table.insert(needsEdit, byRemoteId[id])
          end
        end
      end

      for _, collection in ipairs(collections) do
        if collection ~= defaultCollection then
          logger:info("Check collection start")
          --- These operations are very expensive for some reason so cache them.
          local collectionInfo = collection:getCollectionInfoSummary()
          local albumId = collection:getRemoteId() --[[@as string|nil]]

          if albumId then
            local publishedPhotos = collection:getPublishedPhotos()
            for i, publishedPhoto in ipairs(publishedPhotos) do
              if not publishedPhoto:getEditedFlag() then
                local remoteId = byLocalId[publishedPhoto:getPhoto().localIdentifier]:getRemoteId()
                if media[remoteId] and media[remoteId].file then
                  local target = api:targetAlbumForPhoto(collectionInfo, albumId, publishedPhoto:getPhoto())
                  if not api:isInCorrectAlbums(catalog, media[remoteId], target) then
                    table.insert(needsEdit, publishedPhoto)
                  end
                else
                  table.insert(needsEdit, publishedPhoto)
                end

                LrTasks.yield()
              end
            end
            logger:info("Check collection end")
          end
        end
      end
    end
  end

  local editCount = Utils.length(needsEdit)

  if editCount > 0 then
    Utils.runWithWriteAccess(logger, "Mark to republish", function()
      for idx, publishedPhoto in ipairs(needsEdit) do
        publishedPhoto:setEditedFlag(true)
        LrTasks.yield()
      end
    end)
  end

  if editCount == 0 then
    LrDialogs.message("All photos are published correctly.", nil, "info")
  else
    LrDialogs.message(editCount .. " photos need to be republished.", nil, "warning")
  end
end)
