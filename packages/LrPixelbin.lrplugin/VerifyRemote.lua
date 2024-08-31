local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"

local Utils = require "Utils"
local API = require "API"
local Progress = require "ProgressScope"

local logger = require("Logging")("VerifyRemote")

Utils.runAsync(logger, "VerifyRemoteAsync", function()
  ---@type LrPublishedPhoto[]
  local needsEdit = {}

  local services = LrApplication.activeCatalog():getPublishServices(_PLUGIN.id)
  Progress("Verifying Remote Media", Utils.length(services), function(outerScope)
    for _, service in ipairs(services) do
      ---@type PublishSettings
      local publishSettings = service:getPublishSettings()

      outerScope:childScope(6, function(serviceScope)
        local defaultCollection = Utils.getDefaultCollection(service)

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
        local defaultPhotos = defaultCollection:getPublishedPhotos()
        serviceScope:childScope(Utils.length(defaultPhotos), function(scope)
          for _, publishedPhoto in ipairs(defaultPhotos) do
            byLocalId[publishedPhoto:getPhoto().localIdentifier] = publishedPhoto
            scope:advance()
          end
        end)

        ---@type { [number]: { photo: LrPhoto, edited: boolean, mediaItem: string | nil } }
        local toAdd = {}

        local collections = Utils.listCollections(service)
        serviceScope:childScope(Utils.length(collections) - 1, function(scope)
          for _, collection in ipairs(collections) do
            if collection ~= defaultCollection then
              logger:info("Collection start")
              local publishedPhotos = collection:getPublishedPhotos()
              scope:childScope(Utils.length(publishedPhotos), function(scope)
                for _, publishedPhoto in ipairs(publishedPhotos) do
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

                  scope:advance()
                end

                logger:info("Collection end")
              end)
            end
          end
        end)

        Utils.runWithWriteAccess(logger, "Add Photo to Catalog", function()
          for _, itemToAdd in pairs(toAdd) do
            if itemToAdd.mediaItem then
              local catalogUrl = publishSettings.siteUrl .. "catalog/" .. catalog .. "/media/" .. itemToAdd.mediaItem
              defaultCollection:addPhotoByRemoteId(itemToAdd.photo, itemToAdd.mediaItem, catalogUrl, not itemToAdd
                .edited)
            end
          end
        end)

        local photosToCheck = 0

        logger:info("Default collection start")
        defaultPhotos = defaultCollection:getPublishedPhotos()
        serviceScope:childScope(Utils.length(defaultPhotos), function(scope)
          for _, publishedPhoto in ipairs(defaultPhotos) do
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

            scope:advance()
          end
        end)
        logger:info("Default collection end")

        if photosToCheck > 0 then
          local api = API(publishSettings)
          api:refreshState()

          logger:info("Get " .. photosToCheck .. " media")
          local media = serviceScope:childScope(photosToCheck, function(scope)
            local current = 0
            return api:getMedia(remoteIds, function(completed)
              scope:advance(completed - current)
              current = completed
            end)
          end)
          logger:info("Got media")

          serviceScope:childScope(photosToCheck, function(scope)
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

              scope:advance()
            end
          end)

          serviceScope:childScope(Utils.length(collections) - 1, function(scope)
            for _, collection in ipairs(collections) do
              if collection ~= defaultCollection then
                logger:info("Check collection start")
                --- These operations are very expensive for some reason so cache them.
                local collectionInfo = collection:getCollectionInfoSummary()
                local albumId = collection:getRemoteId() --[[@as string|nil]]

                if albumId then
                  local publishedPhotos = collection:getPublishedPhotos()
                  scope:childScope(Utils.length(publishedPhotos), function(scope)
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
                      end

                      scope:advance()
                    end
                  end)
                  logger:info("Check collection end")
                else
                  scope:advance()
                end
              end
            end
          end)
        else
          serviceScope:advance(3)
        end
      end)
    end
  end)

  local editCount = Utils.length(needsEdit)

  if editCount > 0 then
    Utils.runWithWriteAccess(logger, "Mark to republish", function()
      for idx, publishedPhoto in ipairs(needsEdit) do
        publishedPhoto:setEditedFlag(true)
      end
    end)
  end

  if editCount == 0 then
    LrDialogs.message("All photos are published correctly.", nil, "info")
  else
    LrDialogs.message(editCount .. " photos need to be republished.", nil, "warning")
  end
end)
