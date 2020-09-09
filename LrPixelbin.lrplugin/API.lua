local LrHttp = import "LrHttp"

local logger = require("Logging")("API")
local Utils = require "Utils"

local API = { }

function API:parseHTTPResult(response, info)
  if not response then
    logger:error("Connection to server failed", info.error.errorCode, info.error.name)

    if info.error.errorCode == "badURL" then
      return false, { code = "invalidUrl", name = info.error.name }
    elseif info.error.errorCode == "cannotFindHost" then
      return false, { code = "unknownHost", name = info.error.name }
    else
      return false, { code = "connection", name = info.error.name }
    end
  end

  if info.status == 200 then
    return Utils.jsonDecode(logger, response)
  end

  if info.status == 401 then
    self.loggedIn = false
    return false, {
      code = "notLoggedIn",
      name = LOC "$$$/LrPixelBin/API/NotLoggedIn=Not logged in.",
    }
  end

  if info.status == 404 then
    return false, {
      code = "notFound",
      name = LOC "$$$/LrPixelBin/API/NotFound=Resource not found.",
    }
  end

  local success, str = Utils.jsonEncode(logger, info)
  if success then
    logger:error("Unexpected response from server", response, str)
  else
    logger:error("Unexpected response from server", response)
  end
  return false, {
    code = "unknown",
    name = LOC "$$$/LrPixelBin/API/Unknown=An unknown error occured."
  }
end

function API:MULTIPART(path, content)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.siteUrl .. "api/" .. path

  logger:trace("Multipart request", path)
  local response, info = LrHttp.postMultipart(url, content)
  success, result = self:parseHTTPResult(response, info)

  if not success and info.code == "notLoggedIn" then
    success, result = self:login()
    if not success then
      return success, result
    end

    response, info = LrHttp.postMultipart(url, content)
    success, result = self:parseHTTPResult(response, info)
  end

  return success, result
end

function API:POST(path, content)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.siteUrl .. "api/" .. path

  logger:trace("Post request", path)
  local requestHeaders = {
    { field = "Content-Type", value = "application/json" },
  }

  local success, body = Utils.jsonEncode(logger, content)
  if not success then
    return success, body
  end

  local response, info = LrHttp.post(url, body, requestHeaders)
  success, result = self:parseHTTPResult(response, info)

  if not success and info.code == "notLoggedIn" then
    success, result = self:login()
    if not success then
      return success, result
    end

    response, info = LrHttp.post(url, body, requestHeaders)
    success, result = self:parseHTTPResult(response, info)
  end

  return success, result
end

function API:GET(path)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.siteUrl .. "api/" .. path

  logger:trace("Get request", path)
  local response, info = LrHttp.get(url)
  success, result = self:parseHTTPResult(response, info)

  if not success and info.code == "notLoggedIn" then
    success, result = self:login()
    if not success then
      return success, result
    end

    response, info = LrHttp.get(url)
    success, result = self:parseHTTPResult(response, info)
  end

  return success, result
end

function API:setPassword(password)
  if self.password == password then
    return
  end

  self.password = password
  self.loggedIn = false
  self.errorState = nil
  self.catalogs = {}
  self.albums = {}
end

function API:login()
  if self.loggedIn then
    return true, nil
  end

  local requestHeaders = {
    { field = "Content-Type", value = "application/json" },
  }

  local success, data = Utils.jsonEncode(logger, {
    email = self.email,
    password = self.password,
  })
  if not success then
    return success, data
  end

  logger:trace("Attempting to login")
  local response, info = LrHttp.post(self.siteUrl .. "api/login", data, requestHeaders)
  local success, result = self:parseHTTPResult(response, info)

  if not success and result.code == "notLoggedIn" then
    result = {
      code = "badCredentials",
      name = LOC "$$$/LrPixelBin/API/BadCredentials=Incorrect username or password.",
    }
  end

  if success then
    logger:trace("Login succeeded")
    self.loggedIn = true
    self.errorState = nil
    self.catalogs = result.user.catalogs
    self.albums = result.user.albums

    return success, nil
  end

  logger:error("Login failed", result.code, result.name)
  self.loggedIn = true
  self.errorState = result
  self.catalogs = nil
  self.albums = nil

  return success, self.errorState
end

function getTagPaths(keyword)
  local names = keyword:getSynonyms()
  table.insert(names, keyword:getName())

  local parent = keyword:getParent()
  if parent then
    local results = { }
    for _, path in ipairs(getTagPaths(parent)) do
      for _, name in ipairs(names) do
        table.insert(results, path .. "/" .. name)
      end
    end

    return results
  else
    return names
  end
end

function includeInExport(keyword)
  local attrs = keyword:getAttributes()
  if not attrs["includeOnExport"] then
    return false
  end

  local parent = keyword:getParent()
  if parent then
    return includeInExport(parent)
  end

  return true
end

function API:getMedia(ids)
  local idlist = ""

  for _, id in ipairs(ids) do
    if string.len(idlist) > 0 then
      idlist = idlist .. "," .. id
    else
      idlist = id
    end
  end

  if string.len(idlist) == 0 then
    return {}
  end

  local success, result = self:GET("media/get?id=" .. idlist)
  if not success then
    return {}
  end
  return result
end

function API:addMediaToAlbum(album, media)
  return self:POST("media/relations", {
    {
      operation = "add",
      type = "album",
      media = media,
      items = { album },
    },
  })
end

function API:upload(photo, catalog, filePath, existingId)
  local mediaInfo = { }
  local path

  if existingId then
    mediaInfo.id = existingId
    path = "media/edit"
  else
    mediaInfo.catalog = catalog
    path = "media/create"
  end

  local success, data = Utils.jsonEncode(logger, mediaInfo)
  if not success then
    return success, data
  end

  local params = {
    { name = "json", value = data },
    { name = "file", fileName = photo:getFormattedMetadata("fileName"), filePath = filePath }
  }

  logger:trace("Uploading", params.json)
  return self:MULTIPART(path, params)
end

function API:delete(ids)
  local success, data = Utils.jsonEncode(logger, ids)
  if not success then
    return success, data
  end

  return self:POST("delete", {
    { name = "ids", value = data }
  })
end

function API:refresh()
  self.loggedIn = false
  self:login()
end

function API:logout()
  self:GET("logout", { })
end

function API:error()
  return self.errorState
end

function API:getCatalogs()
  return self.catalogs
end

function API:getCatalog(id)
  if not self.catalogs then
    return nil
  end

  for _, catalog in ipairs(self.catalogs) do
    if catalog.id == id then
      return catalog
    end
  end

  return nil
end

function API:getAlbumsWithParent(catalog, parent)
  local albums = {}
  for _, album in ipairs(self.albums) do
    if album.catalog == catalog and album.parent == parent then
      table.insert(albums, album)
    end
  end

  return albums
end

local instances = { }
local identifiedInstances = { }

function API:cache(identifier)
  if identifiedInstances[identifier] and identifiedInstances[identifier] ~= self then
    identifiedInstances[identifier]:destroy(identifier)
  end

  instances[self.instanceKey] = self
  self.cacheCount = self.cacheCount + 1
  identifiedInstances[identifier] = self

  logger:trace("Cached", identifier, self.instanceKey, self.cacheCount)
end

function API:destroy(identifier)
  if identifiedInstances[identifier] == self then
    identifiedInstances[identifier] = nil
  end

  self.cacheCount = self.cacheCount - 1

  logger:trace("Destroyed", identifier, self.instanceKey, self.cacheCount)

  if self.cacheCount < 0 then
    logger:error("Cache count reduced below zero")
  end

  if self.cacheCount <= 0 then
    instances[self.instanceKey] = nil
  end
end

local function get(settings)
  local key = settings.siteUrl .. "#" .. settings.email
  if instances[key] ~= nil then
    logger:trace("Found cached instance", key)
    instances[key]:setPassword(settings.password)
    return instances[key]
  end

  logger:trace("Creating new instance", key)
  local api = {
    instanceKey = key,
    cacheCount = 0,
    siteUrl = settings.siteUrl,
    email = settings.email,
    password = settings.password,
    loggedIn = false,
    errorState = nil,
    catalogs = {},
    albums = {},
  }
  setmetatable(api, { __index = API })

  return api
end

return get
