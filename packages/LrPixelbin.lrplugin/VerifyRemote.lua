local LrApplication = import "LrApplication"
local LrDialogs = import "LrDialogs"

local Utils = require "Utils"
local API = require "API"
local ProgressScope = require "ProgressScope"

local logger = require("Logging")("VerifyRemote")

Utils.runAsync(logger, "VerifyRemoteAsync", function()
  ---@type LrPublishedPhoto[]
  local needsEdit = {}

  local services = LrApplication.activeCatalog():getPublishServices(_PLUGIN.id)
  ProgressScope.new(LOC("$$$/LrPixelBin/Verify=Verifying Remote Media"), Utils.length(services), function(outerScope)
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
        serviceScope:ipairs(defaultCollection:getPublishedPhotos(), function(_, _, publishedPhoto)
          byLocalId[publishedPhoto:getPhoto().localIdentifier] = publishedPhoto
        end)

        ---@type { [number]: { photo: LrPhoto, edited: boolean, mediaItem: string | nil } }
        local toAdd = {}

        local nonDefaultCollections = Utils.listNonDefaultCollections(service)
        serviceScope:ipairs(nonDefaultCollections, function(scope, _, collection)
          logger:info("Collection start")

          scope:ipairs(collection:getPublishedPhotos(), function(_, _, publishedPhoto)
            local remoteId = publishedPhoto:getRemoteId()

            if not remoteId then
              -- Never published. Just make sure it is marked to be published
              if not publishedPhoto:getEditedFlag() then
                table.insert(needsEdit, publishedPhoto)
                logger:error("Media appears to be published but has no ID")
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
                logger:error("Media appears to be published but has and invalid ID")
              end
            end
          end)

          logger:info("Collection end")
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

        serviceScope:ipairs(defaultCollection:getPublishedPhotos(), function(_, _, publishedPhoto)
          byLocalId[publishedPhoto:getPhoto().localIdentifier] = publishedPhoto
          local remoteId = publishedPhoto:getRemoteId()

          if remoteId then
            byRemoteId[remoteId] = publishedPhoto
            table.insert(remoteIds, remoteId)
            photosToCheck = photosToCheck + 1
          elseif not publishedPhoto:getEditedFlag() then
            logger:error("Media is missing remotely")
            table.insert(needsEdit, publishedPhoto)
          end
        end)

        logger:info("Default collection end")

        if photosToCheck > 0 then
          local api = API(publishSettings)
          api:refreshState()

          logger:info("Get " .. photosToCheck .. " media")
          local media = serviceScope:childScope(photosToCheck, function(scope)
            return api:getMedia(remoteIds, function(completed)
              scope:advance(completed)
            end)
          end)
          logger:info("Got media")

          serviceScope:ipairs(remoteIds, function(_, _, id)
            if not byRemoteId[id]:getEditedFlag() then
              if not media[id] then
                logger:error("Media " .. id .. " is missing remotely")
                table.insert(needsEdit, byRemoteId[id])
              elseif not media[id].file then
                logger:error("Media " .. id .. " has not been processed")
                table.insert(needsEdit, byRemoteId[id])
              end
            end
          end)

          serviceScope:ipairs(nonDefaultCollections, function(scope, _, collection)
            logger:info("Check collection start")
            --- These operations are very expensive for some reason so cache them.
            local collectionInfo = collection:getCollectionInfoSummary()
            local albumId = collection:getRemoteId() --[[@as string|nil]]

            if albumId then
              scope:ipairs(collection:getPublishedPhotos(), function(_, _, publishedPhoto)
                if not publishedPhoto:getEditedFlag() then
                  local remoteId = byLocalId[publishedPhoto:getPhoto().localIdentifier]:getRemoteId()
                  if media[remoteId] and media[remoteId].file then
                    local target = api:targetAlbumForPhoto(collectionInfo, albumId, publishedPhoto:getPhoto())
                    if not api:isInCorrectAlbums(catalog, media[remoteId], target) then
                      table.insert(needsEdit, publishedPhoto)
                      logger:error("Media " .. remoteId .. " is in the wrong albums")
                    end
                  end
                end
              end)
              logger:info("Check collection end")
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
      for _, publishedPhoto in ipairs(needsEdit) do
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
