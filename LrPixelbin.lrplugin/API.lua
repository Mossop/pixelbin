local LrHttp = import "LrHttp"
local LrTasks = import "LrTasks"

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

  if info.status == 503 then
    return false, {
      code = "backoff",
      name = LOC "$$$/LrPixelBin/API/Backoff=Server is overloaded, try again later.",
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

function API:callServer(cb)
  local attemptCount = 0
  repeat
    attemptCount = attemptCount + 1
    local response, info = cb()
    local success, result = self:parseHTTPResult(response, info)

    if success then
      return success, result
    end

    if result.code == "notLoggedIn" then
      if attemptCount == 2 then
        logger:error("Logged out and log in failed. Giving up.")
        return success, result
      end

      logger:info("Logged out, attempting to log in.")
      success, result = self:login()
      if not success then
        return success, result
      end
    elseif result.code == "backoff" then
      if attemptCount == 10 then
        logger:error("Instructed to back off 10 times. Giving up.")
        return success, result
      end

      logger:info("Received backoff status from server. Sleeping for 20 seconds.")
      LrTasks.sleep(10)
    else
      return success, result
    end
  until false
end

function API:MULTIPART(path, content)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.siteUrl .. "api/" .. path

  return self:callServer(function ()
    return LrHttp.postMultipart(url, content)
  end)
end

function API:POST(path, content)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.siteUrl .. "api/" .. path
  local requestHeaders = {
    { field = "Content-Type", value = "application/json" },
  }

  local success, body = Utils.jsonEncode(logger, content)
  if not success then
    return success, body
  end

  return self:callServer(function ()
    return LrHttp.post(url, body, requestHeaders)
  end)
end

function API:GET(path)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.siteUrl .. "api/" .. path

  return self:callServer(function ()
    return LrHttp.get(url)
  end)
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

  local response, info = LrHttp.post(self.siteUrl .. "api/login", data, requestHeaders)
  local success, result = self:parseHTTPResult(response, info)

  if not success and result.code == "notLoggedIn" then
    result = {
      code = "badCredentials",
      name = LOC "$$$/LrPixelBin/API/BadCredentials=Incorrect username or password.",
    }
  end

  if success then
    self.loggedIn = true
    self.errorState = nil
    self.catalogs = result.user.catalogs
    self.albums = result.user.albums

    return success, nil
  end

  logger:error("Login failed", result.code, result.name)
  self.loggedIn = false
  self.errorState = result
  self.catalogs = nil
  self.albums = nil

  return success, self.errorState
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

local function asList(val)
  if type(val) ~= "table" then
    return { val }
  end
  return val
end

function API:upload(photo, catalog, filePath, existingId)
  local mediaInfo = {
    tags = {},
    people = {},
  }
  local path

  local exiftool = _PLUGIN.path .. "/Image-ExifTool/" .. "exiftool"
  local target = os.tmpname()

  local result = LrTasks.execute(exiftool .. " -json " .. filePath .. " > " .. target)
  if result ~= 0 then
    return false, {
      code = "exiftool-error",
      name = LOC "$$$/LrPixelBin/API/ExifToolError=Exiftool returned an error.",
    }
  end


  local handle, error, code = io.open(target, "r")
  if not handle then
    return false, {
      code = "badfile",
      name = error,
    }
  end

  local data = handle:read("*all")
  handle:close()

  local success, exifdata = Utils.jsonDecode(logger, data)
  if not success then
    return success, exifdata
  end

  exifdata = exifdata[1]

  local foundPeople = {}
  if exifdata.PersonInImage then
    for _, person in ipairs(asList(exifdata.PersonInImage)) do
      local personInfo = {
        name = person,
      }
      table.insert(mediaInfo.people, personInfo)
      foundPeople[person] = personInfo
    end
  end

  local dimensions = photo:getRawMetadata("dimensions")
  if exifdata.RegionAppliedToDimensionsW == dimensions.width and
     exifdata.RegionAppliedToDimensionsH == dimensions.height and
     exifdata.RegionAppliedToDimensionsUnit == "pixel" and
     exifdata.RegionName then

    local regionType = asList(exifdata.RegionType)
    local regionAreaX = asList(exifdata.RegionAreaX)
    local regionAreaY = asList(exifdata.RegionAreaY)
    local regionAreaW = asList(exifdata.RegionAreaW)
    local regionAreaH = asList(exifdata.RegionAreaH)
    for i, name in ipairs(asList(exifdata.RegionName)) do
      if regionType[i] == "Face" and foundPeople[name] then
        foundPeople[name].location = {
          left = regionAreaX[i] - (regionAreaW[i] / 2),
          right = regionAreaX[i] + (regionAreaW[i] / 2),
          top = regionAreaY[i] - (regionAreaH[i] / 2),
          bottom = regionAreaY[i] + (regionAreaH[i] / 2),
        }
      end
    end
  end

  if exifdata.HierarchicalSubject then
    for _, tagstr in ipairs(asList(exifdata.HierarchicalSubject)) do
      local tag = {}
      local depth = 1
      local start = 0

      local pos, _ = string.find(tagstr, "|")
      while pos do
        table.insert(tag, string.sub(tagstr, start, pos - 1))
        depth = depth + 1
        start = pos + 1
        pos, _ = string.find(tagstr, "|", start)
      end

      table.insert(tag, string.sub(tagstr, start))

      if not foundPeople[tag[depth]] then
        table.insert(mediaInfo.tags, tag)
      end
    end
  elseif exifdata.Subject then
    for _, tag in ipairs(asList(exifdata.Subject)) do
      if not foundPeople[tag] then
        table.insert(mediaInfo.tags, tag)
      end
    end
  elseif exifdata.Keywords then
    for _, tag in ipairs(asList(exifdata.Keywords)) do
      if not foundPeople[tag] then
        table.insert(mediaInfo.tags, tag)
      end
    end
  end

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
end

function API:destroy(identifier)
  if identifiedInstances[identifier] == self then
    identifiedInstances[identifier] = nil
  end

  self.cacheCount = self.cacheCount - 1

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
    instances[key]:setPassword(settings.password)
    return instances[key]
  end

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
