local LrApplication = import "LrApplication"
local LrTasks = import "LrTasks"

local Connection = require "Connection"

function Init()
  local services = LrApplication.activeCatalog():getPublishServices("org.pixelbin.lrpixelbin")

  for _, service in ipairs(services) do
    local settings = service:getPublishSettings()

    local connection = Connection(service)
    connection:init(settings)
  end
end

LrTasks.startAsyncTask(Init, "PixelBin Init")
