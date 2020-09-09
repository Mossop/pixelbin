local LrApplication = import "LrApplication"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("Init")

Utils.runAsync(logger, "Init", function()
  local services = LrApplication.activeCatalog():getPublishServices("org.pixelbin.lrpixelbin")

  for _, service in ipairs(services) do
    local settings = service:getPublishSettings()

    local api = API(settings)
    api:cache(service.localIdentifier)

    if not api.available then
      api:login()
    end
  end
end)
