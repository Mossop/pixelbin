local LrView = import "LrView"
local LrLogger = import "LrLogger"
local LrDialogs = import "LrDialogs"

require "PixelBinAPI"

local bind = LrView.bind
local share = LrView.share

local logger = LrLogger("PixelBinProvider")
logger:enable("print")

local provider = { }

-- This makes us a publish service
provider.supportsIncrementalPublish = true

provider.hideSections = {
  "exportLocation",
  "fileNaming"
}

provider.exportPresetFields = {
  { key = 'email', default = "Your email address" },
  { key = 'password', default = "Your password" },
  { key = 'site_url', default = "https://pixelbin.org/" },
}

provider.canExportVideo = true
provider.supportsCustomSortOrder = false
provider.disableRenamePublishedCollection = false
provider.disableRenamePublishedCollectionSet = false

provider.allowFileFormats = {
  "JPEG"
}

-- The setting to use for the publish service name if the user doesn't set one
provider.publish_fallbackNameBinding = 'site_url'

provider.titleForGoToPublishedCollection = "disable"

function provider.sectionsForTopOfDialog(f, propertyTable)
  local site_url = f:edit_field {
    width_in_chars = 40,
    tooltip = "The address of the pixelbin server",
    value = bind 'site_url',
    validate = function(view, value)
      if string.len(value) < 8 then
        return false, value, "Website must be a valid website address"
      end

      if string.sub(value, 0, 7) ~= "http://" and string.sub(value, 0, 8) ~= "https://" then
        return false, value, "Website must be a valid website address"
      end

      if string.sub(value, -1) ~= "/" then
        value = value .. "/"
      end

      return true, value
    end,
  }

  local email = f:edit_field {
    width_in_chars = 20,
    tooltip = "The email address that you use to log in to the server",
    value = bind 'email',
    validate = function(view, value)
      return string.len(value) > 0, value, "Email cannot be empty"
    end,
  }

  local password = f:password_field {
    width_in_chars = 20,
    tooltip = "The password you use to log in to the server",
    value = bind 'password',
    validate = function(view, value)
      return string.len(value) > 0, value, "Password cannot be empty"
    end,
  }

  return {
    {
      title = "Login Details",

      synopsis = bind 'email',

      f:column {
        spacing = f:control_spacing(),

        f:row {
          spacing = f:label_spacing(),

          f:static_text {
            title = "Website:",
            alignment = "right",
            width = LrView.share "label_width",
          },

          site_url
        },

        f:row {
          spacing = f:label_spacing(),

          f:static_text {
            title = "Email:",
            alignment = "right",
            width = LrView.share "label_width",
          },

          email
        },

        f:row {
          spacing = f:label_spacing(),

          f:static_text {
            title = "Password:",
            alignment = "right",
            width = LrView.share "label_width",
          },

          password
        },
      },
    }
  }
end

function provider.metadataThatTriggersRepublish(publishSettings)
  return {
    keywords = true,
    dateCreated = true,
    gps = true
  }
end

function provider.canAddCommentsToService(publishSettings)
  return false
end

function provider.processRenderedPhotos(functionContext, exportContext)
  local publishSettings = exportContext.propertyTable

  local api = PixelBinAPI(publishSettings.site_url)
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

function provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback)
end

return provider
