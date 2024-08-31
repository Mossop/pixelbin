local LrView = import "LrView"
local LrDialogs = import "LrDialogs"
local LrApplication = import "LrApplication"
local LrColor = import "LrColor"
local LrPathUtils = import "LrPathUtils"
local LrExportSettings = import "LrExportSettings"

local bind = LrView.bind

local API = require("API")
local Utils = require("Utils")
local ProgressScope = require("ProgressScope")

local logger = require("Logging")("Provider")

local Provider = {}

-- This makes us a publish service
Provider.supportsIncrementalPublish = true

Provider.small_icon = "icon.png"

Provider.hideSections = {
  "exportLocation",
  "fileNaming"
}

Provider.exportPresetFields = {
  { key = "email",    default = "" },
  { key = "password", default = "" },
  { key = "siteUrl",  default = "https://pixelbin.org/" },
  { key = "catalog",  default = "" },
}

Provider.canExportVideo = true
Provider.hidePrintResolution = true
Provider.supportsCustomSortOrder = false
Provider.disableRenamePublishedCollection = false
Provider.disableRenamePublishedCollectionSet = false

Provider.allowFileFormats = {
  "JPEG"
}

Provider.allowColorSpaces = {
  "sRGB"
}

-- The setting to use for the publish service name if the user doesn't set one
Provider.publish_fallbackNameBinding = "siteUrl"

Provider.titleForGoToPublishedCollection = "disable"

function Provider.canAddCommentsToService(publishSettings)
  return false
end

------------------------ Actions

---@param publishSettings PublishSettings
function Provider.getCollectionBehaviorInfo(publishSettings)
  local api = API(publishSettings)

  local catalog = api:getCatalog(publishSettings.catalog)
  if catalog then
    return {
      defaultCollectionName = catalog.name,
      defaultCollectionCanBeDeleted = false,
      canAddCollection = true,
    }
  end

  return {
    defaultCollectionCanBeDeleted = false,
    canAddCollection = true,
  }
end

---@param publishSettings PublishSettings
function Provider.didUpdatePublishService(publishSettings, info)
  logger:info("Publish service updated.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)
end

---@param publishSettings PublishSettings
function Provider.didCreateNewPublishService(publishSettings, info)
  logger:info("New publish service created.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)

  local api = API(publishSettings)

  Utils.runWithWriteAccess(logger, "Delete Default Collection", function()
    local result = api:login()

    if Utils.isError(result) then
      logger:error("Failed to log in to new service.")
      return
    end

    local defaultCollection = Utils.getDefaultCollection(info.publishService)
    defaultCollection:setRemoteId(publishSettings.catalog)
    defaultCollection:setRemoteUrl(publishSettings.siteUrl .. "catalog/" .. publishSettings.catalog)
  end)
end

---@param publishSettings PublishSettings
function Provider.willDeletePublishService(publishSettings, info)
  logger:trace("Publish service deleted.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)
end

---@param publishSettings PublishSettings
function Provider.updateCollectionSettings(publishSettings, info)
  Utils.runWithWriteAccess(logger, "Update Collection", function()
    local api = API(publishSettings)

    if info.isDefaultCollection then
    else
      local albumId = info.publishedCollection:getRemoteId()
      local parent = info.collectionSettings.parent
      if parent == publishSettings.catalog then
        parent = nil
      end

      local result
      if albumId then
        result = api:editAlbum(albumId, {
          name = info.name,
          parent = parent,
        })

        if Utils.isError(result) then
          LrDialogs.showError(Utils.errorString(result))
        end
      else
        result = api:createAlbum(publishSettings.catalog, {
          name = info.name,
          parent = parent,
        })

        if Utils.isError(result) then
          info.publishedCollection:delete()
          LrDialogs.showError(Utils.errorString(result))
        end

        info.publishedCollection:setRemoteId(result.id)
        info.publishedCollection:setRemoteUrl(publishSettings.siteUrl .. "album/" .. result.id)
      end
    end
  end)
end

---@param context LrFunctionContext
---@param exportContext LrExportContext
function Provider.processRenderedPhotos(context, exportContext)
  Utils.logFailures(context, logger, "processRenderedPhotos")

  local exportSession = exportContext.exportSession
  local photoCount = exportSession:countRenditions()

  local title = photoCount > 1
      and LOC("$$$/LrPixelBin/Render/Progress=Publishing ^1 photos to PixelBin", photoCount)
      or LOC "$$$/LrPixelBin/Render/Progress=Publishing one photo to PixelBin"

  ProgressScope.forExportContext(title, 5, exportContext, function(scope)
    ---@type PublishSettings
    local publishSettings = exportContext.propertyTable

    local api = API(publishSettings)
    api:refreshState()
    if not api:authenticated() then
      error("Not authenticated")
    end

    local collection = exportContext.publishedCollection
    local collectionInfo = collection:getCollectionInfoSummary()
    local catalog = publishSettings.catalog
    local album = collection:getRemoteId() --[[@as string | nil]]

    ---@type LrPublishedCollection
    local defaultCollection
    if album == catalog then
      album = nil
      defaultCollection = collection
    else
      defaultCollection = Utils.getDefaultCollection(exportContext.publishService)
    end

    -- A map of photos already supposedly uploaded.
    ---@type { [number]: LrPublishedPhoto }
    local byLocalId = {}

    scope:ipairs(defaultCollection:getPublishedPhotos(), function(_, _, published)
      local photo = published:getPhoto()
      byLocalId[photo.localIdentifier] = published
    end)

    -- First we scan through and find any known ID for each rendition.

    ---@type string[]
    local knownIds = {}
    ---@type { [string]: RenditionInfo }
    local renditionInfoByLocalId = {}
    ---@type { [string]: RenditionInfo }
    local renditionInfoByRemoteId = {}

    scope:childScope(exportSession:countRenditions(), function(renditionScope)
      for _, rendition in exportSession:renditions() do
        local remoteId = nil
        local needsUpload = true

        if album then
          local published = byLocalId[rendition.photo.localIdentifier]
          if published then
            remoteId = published:getRemoteId() --[[@as string|nil]]
            needsUpload = published:getEditedFlag()
          end
        else
          remoteId = rendition.publishedPhotoId --[[@as string|nil]]
        end

        ---@type RenditionInfo
        local info = {
          remoteId = remoteId,
          needsUpload = needsUpload,
          rendition = rendition,
          inAlbum = album and rendition.publishedPhotoId ~= nil or false,
        }

        renditionInfoByLocalId[rendition.photo.localIdentifier] = info

        if remoteId then
          table.insert(knownIds, remoteId)
          renditionInfoByRemoteId[remoteId] = info
        end

        renditionScope:advance()
      end
    end)

    -- Now lookup the known media IDs and for any that are no longer present remotely update our info
    -- accordingly.
    local knownMedia = scope:childScope(Utils.length(knownIds), function(mediaScope)
      return api:getMedia(knownIds, function(count)
        mediaScope:advance(count)
      end)
    end)

    scope:ipairs(knownIds, function(_, _, remoteId)
      local info = renditionInfoByRemoteId[remoteId]

      if not knownMedia[remoteId] then
        info.remoteId = nil
        info.inAlbum = false
        info.needsUpload = true
      elseif not info.needsUpload then
        info.rendition:skipRender()
      end
    end)

    exportContext:startRendering()

    -- Now actually do the uploads.
    scope:childScope(exportSession:countRenditions(), function(renditionScope)
      for _, rendition in exportSession:renditions() do
        ---@type RenditionInfo
        local info = renditionInfoByLocalId[rendition.photo.localIdentifier]
        local remoteId = info.remoteId

        if info.rendition.wasSkipped then
          if remoteId then
            local target = api:targetAlbumForPhoto(collectionInfo, album, info.rendition.photo)
            local result = api:placeInAlbum(catalog, remoteId, target)
            if Utils.isSuccess(result) then
              info.rendition:recordPublishedPhotoId(result.publishedId)
              info.rendition:recordPublishedPhotoUrl(publishSettings.siteUrl .. result.publishedPath)
              logger:info("Recorded")
            else
              info.rendition:uploadFailed(Utils.errorString(result))
            end
          end
        else
          local success, pathOrMessage = info.rendition:waitForRender()
          renditionScope:advance(0.5)

          if success then
            local catalogUrl = publishSettings.siteUrl .. "catalog/" .. catalog .. "/media/"

            if not remoteId then
              local result = api:create(publishSettings)
              if Utils.isSuccess(result) then
                remoteId = result.id
                catalogUrl = catalogUrl .. remoteId

                Utils.runWithWriteAccess(logger, "Add Photo to Catalog", function()
                  defaultCollection:addPhotoByRemoteId(info.rendition.photo, remoteId, catalogUrl, false)
                end)
              else
                info.rendition:uploadFailed(Utils.errorString(result))
              end
            else
              catalogUrl = catalogUrl .. remoteId
            end

            if remoteId then
              local result = api:upload(info.rendition.photo, publishSettings, pathOrMessage, remoteId)
              if Utils.isSuccess(result) then
                if album then
                  Utils.runWithWriteAccess(logger, "Add Photo to Catalog", function()
                    defaultCollection:addPhotoByRemoteId(info.rendition.photo, remoteId, catalogUrl, true)
                  end)
                end

                local target = api:targetAlbumForPhoto(collectionInfo, album, info.rendition.photo)
                local result = api:placeInAlbum(catalog, remoteId, target)
                if Utils.isSuccess(result) then
                  info.rendition:recordPublishedPhotoId(result.publishedId)
                  info.rendition:recordPublishedPhotoUrl(publishSettings.siteUrl .. result.publishedPath)
                  logger:info("Recorded")
                else
                  info.rendition:uploadFailed(Utils.errorString(result))
                end
              else
                info.rendition:uploadFailed(Utils.errorString(result))
              end
            end
          else
            info.rendition:uploadFailed(pathOrMessage)
          end
        end

        renditionScope:advance()
      end
    end)
  end)
end

---@param publishSettings PublishSettings
function Provider.deletePublishedCollection(publishSettings, info)
  if info.isDefaultCollection then
    error(LOC "$$$/LrPixelBin/Delete/Default=The default collection should not be deleted.")
  end

  local api = API(publishSettings)
  api:deleteAlbum(info.remoteId)
end

---@param publishSettings PublishSettings
---@param arrayOfPhotoIds string[]
---@param deletedCallback fun(id: string)
---@param collectionId number
function Provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback, collectionId)
  local api = API(publishSettings)
  local collection = Utils.getCollectionsForId(collectionId)
  local collectionInfo = collection:getCollectionInfoSummary()

  if (collectionInfo.isDefaultCollection) then
    -- Deleting from the entire service.
    local publishService = collection:getService()
    ---@type { [string]: LrPhoto }
    local remotePhotos = {}

    for _, photo in ipairs(collection:getPublishedPhotos()) do
      remotePhotos[photo:getRemoteId()] = photo:getPhoto()
    end

    Utils.runWithWriteAccess(logger, "Remove photos", function()
      for _, remoteId in ipairs(arrayOfPhotoIds) do
        local photo = remotePhotos[remoteId]
        if photo then
          local collections = photo:getContainedPublishedCollections()
          for _, collectionSet in ipairs(collections) do
            if collectionSet:getService() == publishService then
              collectionSet:removePhotos({ photo })
            end
          end
        end
      end
    end)

    api:deleteMedia(arrayOfPhotoIds)

    for _, remoteId in ipairs(arrayOfPhotoIds) do
      deletedCallback(remoteId)
    end
  else
    -- Just deleting from this album.
    ---@type { [string]: string[] }
    local albums = {}

    for _, id in ipairs(arrayOfPhotoIds) do
      local found, _, album, remoteId = string.find(id, "(.+)/(.+)")
      if found then
        if not albums[album] then
          albums[album] = {}
        end

        table.insert(albums[album], remoteId)
      end
    end

    for album, media in pairs(albums) do
      local result = api:removeMediaFromAlbum(album, media)
      if Utils.isSuccess(result) then
        for _, remoteId in ipairs(media) do
          deletedCallback(album .. "/" .. remoteId)
        end
      else
        error(Utils.errorString(result))
      end
    end
  end
end

------------------------ UI

local function updateCanExport(propertyTable)
  if string.len(propertyTable.error) > 0 then
    propertyTable.LR_cantExportBecause = propertyTable.error
    return
  end

  if string.len(propertyTable.catalog) == 0 then
    propertyTable.LR_cantExportBecause = LOC "$$$/LrPixelBin/Settings/NoCatalog=No catalog selected"
    return
  end

  propertyTable.LR_cantExportBecause = nil
end

local function verifyLogin(propertyTable)
  if string.len(propertyTable.siteUrl) < 8 or
      (string.sub(propertyTable.siteUrl, 0, 7) ~= "http://" and string.sub(propertyTable.siteUrl, 0, 8) ~= "https://") then
    propertyTable.error = LOC "$$$/LrPixelBin/Settings/SiteUrl/Invalid=Must give a valid website"
    updateCanExport(propertyTable)
    return
  end

  if string.len(propertyTable.email) == 0 then
    propertyTable.error = LOC "$$$/LrPixelBin/Settings/Email/Empty=You must give a valid email address"
    updateCanExport(propertyTable)
    return
  end

  if string.len(propertyTable.password) == 0 then
    propertyTable.error = LOC "$$$/LrPixelBin/Settings/Password/Empty=You must give a password"
    updateCanExport(propertyTable)
    return
  end

  propertyTable.error = ""

  Utils.runAsync(logger, "verifyLogin", function()
    local api = API(propertyTable)
    api:refreshState()
    local error = api:error()

    if Utils.isError(error) then
      propertyTable.error = Utils.errorString(error)
    else
      local catalogs = {}
      for _, catalog in ipairs(api:getCatalogs()) do
        table.insert(catalogs, { value = catalog.id, title = catalog.name })
      end
      propertyTable.catalogs = catalogs
    end

    updateCanExport(propertyTable)
  end)
end

function Provider.startDialog(propertyTable)
  if not propertyTable.LR_editingExistingPublishConnection then
    propertyTable.LR_format = "JPEG"
    propertyTable.LR_export_colorSpace = "sRGB"
    propertyTable.LR_jpeg_quality = 0.9
    propertyTable.LR_jpeg_useLimitSize = false
    propertyTable.LR_size_doConstrain = false
    propertyTable.LR_outputSharpeningOn = false
    propertyTable.LR_metadata_keywordOptions = "lightroomHierarchical"
    propertyTable.LR_embeddedMetadataOption = "all"
    propertyTable.LR_removeLocationMetadata = false
    propertyTable.LR_removeFaceMetadata = false
    propertyTable.LR_includeFaceTagsInIptc = true
    propertyTable.LR_includeVideoFiles = true
    propertyTable.LR_useWatermark = false

    propertyTable.LR_cantExportBecause = LOC "$$$/LrPixelBin/Settings/NotLoggedIn=Not yet logged in"

    propertyTable.catalogs = {}

    local presets = LrExportSettings.videoExportPresets()
    for _, preset in ipairs(presets) do
      if preset:name() == "High" and preset:formatID() == "h.264" then
        LrExportSettings.applyVideoExportPreset(propertyTable, preset)
        break
      end
    end
  end

  propertyTable.error = ""

  updateCanExport(propertyTable)
  verifyLogin(propertyTable)

  propertyTable:addObserver("email", verifyLogin)
  propertyTable:addObserver("password", verifyLogin)
  propertyTable:addObserver("siteUrl", verifyLogin)
  propertyTable:addObserver("catalog", updateCanExport)
end

function Provider.sectionsForTopOfDialog(f, propertyTable)
  local siteUrl = f:edit_field {
    width_in_chars = 40,
    tooltip = LOC "$$$/LrPixelBin/Settings/SiteUrl/Tooltip=The address of the pixelbin server",
    value = bind "siteUrl",
    validate = function(view, value)
      if string.len(value) < 8 then
        return true, value
      end

      if string.sub(value, 0, 7) ~= "http://" and string.sub(value, 0, 8) ~= "https://" then
        return true, value
      end

      if string.sub(value, -1) ~= "/" then
        value = value .. "/"
      end

      return true, value
    end,
  }

  local email = f:edit_field {
    width_in_chars = 20,
    tooltip = LOC "$$$/LrPixelBin/Settings/Email/Tooltip=The email address that you use to log in to the server",
    value = bind "email",
  }

  local password = f:password_field {
    width_in_chars = 20,
    tooltip = LOC "$$$/LrPixelBin/Settings/Password/Tooltip=The password you use to log in to the server",
    value = bind "password",
  }

  local catalog = f:popup_menu {
    width_in_chars = 20,
    tooltip = LOC "$$$/LrPixelBin/Settings/Catalog/Tooltip=The catalog to store media in",
    enabled = bind {
      key = "catalogs",
      transform = function(value)
        if propertyTable.LR_editingExistingPublishConnection then
          return false
        end

        for _ in pairs(value) do
          return true
        end

        return false
      end,
    },
    value = bind "catalog",
    items = bind "catalogs",
  }

  return {
    {
      title = LOC "$$$/LrPixelBin/Settings/LoginTitle=Login Details",

      synopsis = bind "email",

      f:column {
        fill_horizontal = 1,
        spacing = f:control_spacing(),

        f:row {
          fill_horizontal = 1,
          spacing = f:label_spacing(),

          f:static_text {
            title = LOC "$$$/LrPixelBin/Settings/SiteUrl/Label=Website:",
            alignment = "right",
            width = LrView.share "label_width",
          },

          siteUrl
        },

        f:row {
          fill_horizontal = 1,
          spacing = f:label_spacing(),

          f:static_text {
            title = LOC "$$$/LrPixelBin/Settings/Email/Label=Email:",
            alignment = "right",
            width = LrView.share "label_width",
          },

          email
        },

        f:row {
          fill_horizontal = 1,
          spacing = f:label_spacing(),

          f:static_text {
            title = LOC "$$$/LrPixelBin/Settings/Password/Label=Password:",
            alignment = "right",
            width = LrView.share "label_width",
          },

          password
        },

        f:row {
          fill_horizontal = 1,
          spacing = f:label_spacing(),
          visible = bind {
            key = "error",
            transform = function(value)
              return string.len(value) > 0
            end,
          },

          f:spacer {
            width = LrView.share "label_width",
          },

          f:static_text {
            fill_horizontal = 1,
            text_color = LrColor(1, 0, 0),
            title = bind "error",
            alignment = "left",
          },
        },
      },
    },
    {
      title = LOC "$$$/LrPixelBin/Settings/CatalogTitle=Catalog",

      f:column {
        fill_horizontal = 1,
        spacing = f:control_spacing(),

        f:row {
          fill_horizontal = 1,
          spacing = f:label_spacing(),

          f:static_text {
            title = LOC "$$$/LrPixelBin/Settings/Catalog/Label=Catalog:",
            alignment = "right",
            width = LrView.share "label_width",
          },

          catalog
        },
      },
    },
  }
end

function Provider.viewForCollectionSettings(f, publishSettings, info)
  if info.isDefaultCollection then
    return
  end

  local api = API(publishSettings)

  if not api:authenticated() then
    info.collectionSettings.LR_canSaveCollection = false

    return f:group_box {
      fill_horizontal = 1,
      title = LOC "$$$/LrPixelBin/Collection/NotConnected/Title=Not Connected",

      f:row {
        fill_horizontal = 1,
        spacing = f:label_spacing(),

        f:static_text {
          title = LOC "$$$/LrPixelBin/Collection/NotConnected/Error=Please visit the publish service settings.",
          alignment = "left",
          color = LrColor(1, 0, 0)
        },
      },
    }
  end

  local catalog = api:getCatalog(publishSettings.catalog)
  if not catalog then
    info.collectionSettings.LR_canSaveCollection = false

    return f:group_box {
      fill_horizontal = 1,
      title = LOC "$$$/LrPixelBin/Collection/UnknownCatalog/Title=Unknown Catalog",

      f:row {
        fill_horizontal = 1,
        spacing = f:label_spacing(),

        f:static_text {
          title = LOC "$$$/LrPixelBin/Collection/UnknownCatalog/Error=The publish service is connected to an unknown catalog.",
          alignment = "left",
          color = LrColor(1, 0, 0)
        },
      },
    }
  end

  if not info.name then
    info.collectionSettings.parent = catalog.id
    info.collectionSettings.subalbums = "none"
    info.collectionSettings.pathstrip = 0
  end

  local albumTbl = {
    fill_horizontal = 1,
    title = LOC "$$$/LrPixelBin/Collection/Album=Store album in:",
    bind_to_object = info.collectionSettings,

    f:row {
      fill_horizontal = 1,
      spacing = f:label_spacing(),

      f:radio_button {
        title = catalog.name,
        value = bind "parent",
        checked_value = catalog.id,
      },
    },
  }

  local remote = nil
  if info.publishedCollection then
    remote = info.publishedCollection:getRemoteId()
  end

  local function addRowsForAlbums(parent, depth)
    for album in api:getAlbumsWithParent(catalog.id, parent) do
      if album.id ~= remote then
        table.insert(albumTbl, f:row {
          fill_horizontal = 1,
          spacing = f:label_spacing(),
          margin_left = (depth + 1) * 20,

          f:radio_button {
            title = album.name,
            value = bind "parent",
            checked_value = album.id,
          },
        })

        addRowsForAlbums(album.id, depth + 1)
      end
    end
  end

  addRowsForAlbums(nil, 0)

  local subTbl = {
    fill_horizontal = 1,
    title = LOC "$$$/LrPixelBin/Collection/Path=Create inner albums?:",
    bind_to_object = info.collectionSettings,
  }

  local currentCatalog = LrApplication.activeCatalog()
  local photo = currentCatalog:getTargetPhoto()

  if photo then
    local photoPath = photo:getRawMetadata("path")
    local basePath = LrPathUtils.parent(photoPath)
    local filename = LrPathUtils.leafName(photoPath)
    local catalogPath = api:getCatalogFolderPath(basePath)
    local filesystemPath = api:getFilesystemPath(basePath)

    local function buildExample()
      local path
      if info.collectionSettings.subalbums == "none" then
        path = {}
      else
        if info.collectionSettings.subalbums == "catalog" then
          path = Utils.shallowClone(catalogPath)
        elseif info.collectionSettings.subalbums == "custom" then
          path = Utils.shallowClone(filesystemPath)
        end

        local strip = info.collectionSettings.pathstrip
        while strip > 0 do
          table.remove(path, 1)
          strip = strip - 1
        end
      end

      table.insert(path, filename)
      info.collectionSettings.example = table.concat(path, " / ")
    end

    info.collectionSettings:addObserver("subalbums", buildExample)
    info.collectionSettings:addObserver("pathstrip", buildExample)

    buildExample()

    table.insert(subTbl, f:row {
      fill_horizontal = 1,
      spacing = f:label_spacing(),

      f:static_text {
        title = LOC "$$$/LrPixelBin/Collection/Example=Result:",
      },

      f:static_text {
        fill_horizontal = 1,
        title = bind "example",
      },
    })
  end

  table.insert(subTbl, f:row {
    fill_horizontal = 1,
    spacing = f:label_spacing(),

    f:radio_button {
      title = LOC "$$$/LrPixelBin/Collection/NoSub=Put all media in the chosen album.",
      value = bind "subalbums",
      checked_value = "none",
    },
  })

  table.insert(subTbl, f:row {
    fill_horizontal = 1,
    spacing = f:label_spacing(),

    f:radio_button {
      title = LOC "$$$/LrPixelBin/Collection/DefaultSub=Create inner albums to match catalog folders.",
      value = bind "subalbums",
      checked_value = "catalog",
    },
  })

  table.insert(subTbl, f:row {
    fill_horizontal = 1,
    spacing = f:label_spacing(),

    f:radio_button {
      title = LOC "$$$/LrPixelBin/Collection/CustomSub=Use the filesystem path:",
      value = bind "subalbums",
      checked_value = "custom",
    },
  })

  table.insert(subTbl, f:row {
    fill_horizontal = 1,
    margin_left = 20,
    spacing = f:label_spacing(),

    f:static_text {
      title = LOC "$$$/LrPixelBin/Collection/SubStrip=Strip leading path components:",
      enabled = bind {
        key = "subalbums",
        transform = function(value)
          return value ~= "none"
        end,
      }
    },

    f:edit_field {
      width_in_digits = 3,
      min = 0,
      precision = 0,
      immediate = true,
      value = bind "pathstrip",
      enabled = bind {
        key = "subalbums",
        transform = function(value)
          return value ~= "none"
        end,
      }
    },
  })

  return f:column {
    fill_horizontal = 1,
    spacing = f:control_spacing(),

    f:group_box(albumTbl),

    f:group_box(subTbl)
  }
end

return Provider
