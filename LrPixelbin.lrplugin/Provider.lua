local LrView = import "LrView"
local LrDialogs = import "LrDialogs"
local LrFunctionContext = import "LrFunctionContext"
local LrColor = import "LrColor"

local bind = LrView.bind

local API = require("API.lua")

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
  LrFunctionContext.postAsyncTaskWithContext("didUpdatePublishService", function(context)
    LrDialogs.attachErrorDialogToFunctionContext(context)

    local api = API(publishSettings.siteUrl, publishSettings.email, publishSettings.password)
    api:cache(info.publishService.localIdentifier)
  end)
end

function Provider.didCreateNewPublishService(publishSettings, info)
  LrFunctionContext.postAsyncTaskWithContext("didCreateNewPublishService", function(context)
    LrDialogs.attachErrorDialogToFunctionContext(context)

    local api = API(publishSettings.siteUrl, publishSettings.email, publishSettings.password)
    api:cache(info.publishService.localIdentifier)
  end)
end

function Provider.willDeletePublishService(publishSettings, info)
  LrFunctionContext.postAsyncTaskWithContext("willDeletePublishService", function(context)
    LrDialogs.attachErrorDialogToFunctionContext(context)

    local api = API(publishSettings.siteUrl, publishSettings.email, publishSettings.password)
    api:destroy(info.publishService.localIdentifier)
  end)
end

function Provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback)
  local api = PixelBinAPI(publishSettings.siteUrl)
  local success, result = api:login(publishSettings.email, publishSettings.password)

  if not success then
    LrDialogs.message(result, nil, "critical")
    return
  end

  local success, result = api:delete(arrayOfPhotoIds)
  if success then
    for _, photoId in arrayOfPhotoIds do
      deletedCallback(photoId)
    end
  end

  api:logout()
end

function Provider.processRenderedPhotos(functionContext, exportContext)
  local publishSettings = exportContext.propertyTable

  local api = PixelBinAPI(publishSettings.siteUrl)
  local success, result = api:login(publishSettings.email, publishSettings.password)

  if not success then
    LrDialogs.message(result, nil, "critical")
    return
  end

  for i, rendition in exportContext:renditions() do
    local success, pathOrMessage = rendition:waitForRender()
    if success then
      local success, result = api:upload(rendition.photo, pathOrMessage)
      if success then
        rendition:recordPublishedPhotoId(result["id"])
      else
        rendition:uploadFailed(result)
      end
    else
      rendition:uploadFailed(pathOrMessage)
    end
  end

  api:logout()
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

  LrFunctionContext.postAsyncTaskWithContext("verifyLogin", function(context)
    LrDialogs.attachErrorDialogToFunctionContext(context)

    local api = API(propertyTable.siteUrl, propertyTable.email, propertyTable.password)
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

return Provider
