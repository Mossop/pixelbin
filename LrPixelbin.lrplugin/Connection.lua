local json = require "json"

local logger = require("Logging")("Connection")

local connections = { }

local Connection = { }

function Connection:registerCollectionSet(set)
end

function Connection:init(settings)
  self.settings = settings
  logger:trace("init", self.publishService.localIdentifier, settings.email)

  self:registerCollectionSet(self.publishService)
end

function Connection:destroy(settings)
  connections[self.publishService.localIdentifier] = nil
end

local function connection(publishService)
  if connections[publishService.localIdentifier] == nil then
    local connection = { publishService = publishService }
    setmetatable(connection, { __index = Connection })
    connections[publishService.localIdentifier] = connection
  end

  return connections[publishService.localIdentifier]
end

return connection
