local LrView = import "LrView"
local LrDialogs = import "LrDialogs"
local LrErrors = import "LrErrors"
local LrColor = import "LrColor"

local bind = LrView.bind

local API = require("API")
local Utils = require("Utils")

local logger = require("Logging")("Provider")

local Provider = { }

-- This makes us a publish service
Provider.supportsIncrementalPublish = true

Provider.hideSections = {
  "exportLocation",
  "fileNaming"
}

Provider.exportPresetFields = {
  { key = "email", default = "" },
  { key = "password", default = "" },
  { key = "siteUrl", default = "https://pixelbin.org/" },
  { key = "catalog", default = "" },
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

function Provider.didUpdatePublishService(publishSettings, info)
  logger:info("Publish service updated.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)
end

function Provider.didCreateNewPublishService(publishSettings, info)
  logger:info("New publish service created.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)

  local api = API(publishSettings)

  Utils.runWithWriteAccess(logger, "Delete Default Collection", function()
    local success, _ = api:login()

    if not success then
      logger:error("Failed to log in to new service.")
      return
    end

    local defaultCollection = Utils.getDefaultCollection(info.publishService)
    defaultCollection:setRemoteId(publishSettings.catalog)
    defaultCollection:setRemoteUrl(publishSettings.siteUrl .. "catalog/" .. publishSettings.catalog)
  end)
end

function Provider.willDeletePublishService(publishSettings, info)
  logger:trace("Publish service deleted.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)
end

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

      local success, result
      if albumId then
        success, result = api:editAlbum({
          id = albumId,
          name = info.name,
          parent = parent,
        })

        if not success then
          LrDialogs.showError(result.name)
        end
      else
        success, result = api:createAlbum({
          name = info.name,
          parent = parent,
          catalog = publishSettings.catalog,
        })

        if not success then
          info.publishedCollection:delete()
          LrDialogs.showError(result.name)
        end

        info.publishedCollection:setRemoteId(result.id)
        info.publishedCollection:setRemoteUrl(publishSettings.siteUrl .. "album/" .. result.id)
      end
    end
  end)
end

function Provider.processRenderedPhotos(context, exportContext)
  Utils.logFailures(context, logger, "processRenderedPhotos")

  local exportSession = exportContext.exportSession
  local publishSettings = exportContext.propertyTable
  local collection = exportContext.publishedCollection

  local catalog = publishSettings.catalog
  local album = collection:getRemoteId()
  local defaultCollection = nil
  if album == catalog then
    album = nil
    defaultCollection = collection
  else
    defaultCollection = Utils.getDefaultCollection(exportContext.publishService)
  end

  local publishedPhotos = {}
  for _, published in ipairs(defaultCollection:getPublishedPhotos()) do
    local photo = published:getPhoto()
    publishedPhotos[photo.localIdentifier] = published
  end

  local photoCount = exportSession:countRenditions()

  local progressScope = exportContext:configureProgress({
    title = photoCount > 1
      and LOC("$$$/LrPixelBin/Render/Progress=Publishing ^1 photos to PixelBin", photoCount)
      or LOC "$$$/LrPixelBin/Render/Progress=Publishing one photo to PixelBin",
  })

  local api = API(publishSettings)

  -- First we scan through and find any known ID for each rendition.

  local knownIds = {}
  local renditionsById = {}
  local renditions = {}

  for _, rendition in exportContext:renditions() do
    if not rendition.wasSkipped then
      local remoteId = nil
      if album then
        local published = publishedPhotos[rendition.photo.localIdentifier]
        if published then
          remoteId = published:getRemoteId()
        end
      else
        remoteId = rendition.publishedPhotoId
      end

      local info = {
        remoteId = remoteId,
        rendition = rendition,
        inAlbum = album and rendition.publishedPhotoId ~= nil,
      }

      if remoteId then
        table.insert(knownIds, remoteId)
        renditionsById[remoteId] = info
      end

      table.insert(renditions, info)
    end
  end

  -- Now lookup the known media IDs and for any that are no longer present remotely update our info
  -- accordingly.
  local knownMedia = api:getMedia(knownIds)
  for index, remoteId in ipairs(knownIds) do
    if not knownMedia[index] then
      renditionsById[remoteId].remoteId = nil
      renditionsById[remoteId].inAlbum = false
    end
  end

  -- Now actually do the uploads.
  for i, info in ipairs(renditions) do
    progressScope:setPortionComplete((i - 1) / photoCount)

    local success, pathOrMessage = info.rendition:waitForRender()
    progressScope:setPortionComplete((i - 1) / photoCount)

    if progressScope:isCanceled() then
      break
    end

    if success then
      local success, result = api:upload(info.rendition.photo, catalog, album, pathOrMessage, info.remoteId, info.inAlbum)
      if success then
        local remoteId = result.id
        local catalogUrl = publishSettings.siteUrl .. "catalog/" .. catalog .. "/media/" .. remoteId

        if album then
          info.rendition:recordPublishedPhotoId(album .. "/" .. remoteId)
          info.rendition:recordPublishedPhotoUrl(publishSettings.siteUrl .. "album/" .. album .. "/media/" .. remoteId)
          Utils.runWithWriteAccess(logger, "Add Photo to Catalog", function()
            defaultCollection:addPhotoByRemoteId(info.rendition.photo, remoteId, catalogUrl, true)
          end)
        else
          info.rendition:recordPublishedPhotoId(remoteId)
          info.rendition:recordPublishedPhotoUrl(catalogUrl)
        end
      else
        info.rendition:uploadFailed(result.name)
      end
    else
      info.rendition:uploadFailed(pathOrMessage)
    end
  end

  progressScope:done()
end

function Provider.deletePublishedCollection(publishSettings, info)
  if info.isDefaultCollection then
    error(LOC "$$$/LrPixelBin/Delete/Default=The default collection should not be deleted.")
  end

  local api = API(publishSettings)
  api:deleteAlbum(info.remoteId)
end

function Provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback, collectionId)
  local hasDelete = false
  local mediaToDelete = {}
  local albums = {}
  local api = API(publishSettings)

  for _, id in ipairs(arrayOfPhotoIds) do
    local found, _, album, remoteId = string.find(id, "(.+)/(.+)")
    if found == nil then
      hasDelete = true
      table.insert(mediaToDelete, id)
    else
      if not albums[album] then
        albums[album] = { remoteId }
      end

      table.insert(albums[album], remoteId)
    end
  end

  for album, media in pairs(albums) do
    local success, result = api:removeMediaFromAlbum(album, media)
    if success then
      for _, remoteId in ipairs(media) do
        deletedCallback(album .. "/" .. remoteId)
      end
    else
      error(result.name)
    end
  end

  if hasDelete then
    api:deleteMedia(mediaToDelete)

    for _, remoteId in ipairs(mediaToDelete) do
      deletedCallback(remoteId)
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
    api:login()
    local error = api:error()

    if error then
      propertyTable.error = error.name
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

  if not api.loggedIn then
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
  end

  local tbl = {
    fill_horizontal = 1,
    title = LOC "$$$/LrPixelBin/Collection/Title=Store album in:",
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
    local albums = api:getAlbumsWithParent(catalog.id, parent)

    for _, album in ipairs(albums) do
      if album.id ~= remote then
        table.insert(tbl, f:row {
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

  return f:group_box(tbl)
end

return Provider
