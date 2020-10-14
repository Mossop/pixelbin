local LrApplication = import "LrApplication"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("Init")

Utils.runAsync(logger, "Init", function()
  local services = LrApplication.activeCatalog():getPublishServices("org.pixelbin.lrpixelbin")

  for _, service in ipairs(services) do
    local settings = service:getPublishSettings()

    local api = API(settings)

    if not api.available then
      api:login()
    end
  end

  local folders = LrApplication.activeCatalog():getFolders()
  for _, folder in ipairs(folders) do
    logger:trace(folder:getPath(), folder:getParent() == nil)
  end
end)
