local LrView = import "LrView"
local LrDialogs = import "LrDialogs"
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

function Provider.didUpdatePublishService(publishSettings, info)
  logger:info("Publish service updated.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)

  local api = API(publishSettings)
  api:cache(info.publishService.localIdentifier)
  api:login()
end

function Provider.didCreateNewPublishService(publishSettings, info)
  logger:info("New publish service created.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)

  Utils.runWithWriteAccess(logger, "Create Default Collection", function()
    local api = API(publishSettings)
    api:cache(info.publishService.localIdentifier)

    local success, _ = api:login()

    if not success then
      logger:error("Failed to log in to new service.")
      return
    end

    for _, collection in ipairs(info.publishService:getChildCollections()) do
      local collectionInfo = collection:getCollectionInfoSummary()
      if collectionInfo.isDefaultCollection then
        local catalog = api:getCatalog(publishSettings.catalog)
        collection:setCollectionSettings({
          album = publishSettings.catalog,
        })

        if catalog then
          collection:setName(catalog.name)
        end
      end
    end
  end)
end

function Provider.willDeletePublishService(publishSettings, info)
  logger:trace("Publish service deleted.", info.publishService:getName(),
    info.publishService.localIdentifier, publishSettings.siteUrl, publishSettings.email,
    publishSettings.catalog)

  local api = API(publishSettings)
  api:destroy(info.publishService.localIdentifier)
end

function Provider.processRenderedPhotos(context, exportContext)
  Utils.logFailures(context, logger, "processRenderedPhotos")

  local exportSession = exportContext.exportSession
  local publishSettings = exportContext.propertyTable
  local collection = exportContext.publishedCollection
  local collectionInfo = collection:getCollectionInfoSummary()

  local catalog = publishSettings.catalog
  local album = collectionInfo.collectionSettings.album
  if album and (string.len(album) == 0 or album == catalog) then
    album = nil
  end

  local photoCount = exportSession:countRenditions()

  local progressScope = exportContext:configureProgress({
    title = photoCount > 1
      and LOC("$$$/LrPixelBin/Render/Progress=Publishing ^1 photos to PixelBin", photoCount)
      or LOC "$$$/LrPixelBin/Render/Progress=Publishing one photo to PixelBin",
  })

  local api = API(publishSettings)

  local knownMediaIds = {}
  local renditions = {}

  for _, rendition in exportContext:renditions() do
    if not rendition.wasSkipped then
      local mediaId = rendition.publishedPhotoId

      if mediaId then
        table.insert(knownMediaIds, mediaId)
      end
      table.insert(renditions, rendition)
    end
  end

  local knownMedia = api:getMedia(knownMediaIds)
  local successfulMedia = {}
  local hadSuccess = false

  for i, rendition in ipairs(renditions) do
    progressScope:setPortionComplete((i - 1) / photoCount)

    local mediaId = nil
    for _, media in ipairs(knownMedia) do
      if media.id == rendition.publishedPhotoId then
        mediaId = media.id
        break
      end
    end

    local success, pathOrMessage = rendition:waitForRender()
    progressScope:setPortionComplete((i - 1) / photoCount)

    if progressScope:isCanceled() then
      break
    end

    if success then
      local success, result = api:upload(rendition.photo, catalog, pathOrMessage, mediaId)
      if success then
        rendition:recordPublishedPhotoId(result.id)
        table.insert(successfulMedia, result.id)
        hadSuccess = true
      else
        rendition:uploadFailed(result.name)
      end
    else
      rendition:uploadFailed(pathOrMessage)
    end
  end

  if hadSuccess and album then
    local success, result = api:addMediaToAlbum(album, successfulMedia)
    if not success then
      LrDialogs.showError(
        LOC("$$$/LrPixelBin/Render/AlbumFailure=Failed to add media to album: ^1", result.name)
      )
    end
  end

  progressScope:done()
end

function Provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback)
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
    info.collectionSettings.album = catalog.id
  end

  local tbl = {
    fill_horizontal = 1,
    title = LOC "$$$/LrPixelBin/Collection/Title=Album to store in:",
    bind_to_object = info.collectionSettings,

    f:row {
      fill_horizontal = 1,
      spacing = f:label_spacing(),

      f:radio_button {
        title = catalog.name,
        value = bind "album",
        checked_value = catalog.id,
      },
    },
  }

  local function addRowsForAlbums(parent, depth)
    local albums = api:getAlbumsWithParent(catalog.id, parent)

    for _, album in ipairs(albums) do
      table.insert(tbl, f:row {
        fill_horizontal = 1,
        spacing = f:label_spacing(),
        margin_left = (depth + 1) * 20,

        f:radio_button {
          title = album.name,
          value = bind "album",
          checked_value = album.id,
        },
      })

      addRowsForAlbums(album.id, depth + 1)
    end
  end

  addRowsForAlbums(nil, 0)

  return f:group_box(tbl)
end

return Provider
