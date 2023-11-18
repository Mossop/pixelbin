local LrApplication = import "LrApplication"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("Refresh")

Utils.runAsync(logger, "Refresh", function()
  local services = LrApplication.activeCatalog():getPublishServices("org.pixelbin.lrpixelbin")

  for _, service in ipairs(services) do
    local settings = service:getPublishSettings()

    local api = API(settings)
    api:refreshState()
  end
end)
