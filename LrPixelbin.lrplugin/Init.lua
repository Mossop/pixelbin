local LrApplication = import "LrApplication"
local LrFunctionContext = import "LrFunctionContext"
local LrDialogs = import "LrDialogs"

local API = require "API"

LrFunctionContext.postAsyncTaskWithContext("init", function(context)
  LrDialogs.attachErrorDialogToFunctionContext(context)

  local services = LrApplication.activeCatalog():getPublishServices("org.pixelbin.lrpixelbin")

  for _, service in ipairs(services) do
    local settings = service:getPublishSettings()

    local api = API(settings.siteUrl, settings.email, settings.password)
    api:cache(service.localIdentifier)
  end
end)
