local LrApplication = import "LrApplication"

local Utils = require "Utils"
local API = require "API"

local logger = require("Logging")("Init")

Utils.runAsync(logger, "Init", function(context)
  local services = LrApplication.activeCatalog():getPublishServices(_PLUGIN.id)

  for _, service in ipairs(services) do
    local settings = service:getPublishSettings()

    local api = API(settings)

    if not api:authenticated() then
      api:login()
    end

    local collection = Utils.getDefaultCollection(service)
    local collectionInfo = collection:getCollectionInfoSummary()

    local sourceId = api:getSourceId(collectionInfo.collectionSettings.sourceId, collectionInfo.name)
    if Utils.isSuccess(sourceId) then
      if collectionInfo.collectionSettings.sourceId ~= sourceId then
        Utils.runWithWriteAccess(logger, "Init", function()
          collection:setCollectionSettings({
            sourceId = sourceId
          })
        end)

        for _, published in ipairs(collection:getPublishedPhotos()) do
          local remoteId = published:getRemoteId() --[[@as string]]
          api:setSource(remoteId, Utils.result(sourceId))
        end
      end
    end
  end
end)
