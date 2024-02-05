local LrHttp = import "LrHttp"
local LrTasks = import "LrTasks"

local json = require "json"
local utf8 = require "utf8"

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
    self.apiToken = nil
    return false, {
      code = "notLoggedIn",
      name = LOC "$$$/LrPixelBin/API/NotLoggedIn=Not logged in.",
    }
  end

  if info.status == 413 then
    return false, {
      code = "tooLarge",
      name = LOC "$$$/LrPixelBin/API/TooLarge=This file is too large.",
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

  local success, result = Utils.jsonDecode(logger, response)
  if success and result.code then
    if result.data and result.data.message then
      return false, {
        code = result.code,
        name = result.data.message
      }
    end
    return false, {
      code = result.code,
      name = LOC "$$$/LrPixelBin/API/Unknown=An unknown error occured."
    }
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

  local url = self.apiUrl .. path

  return self:callServer(function ()
    return LrHttp.postMultipart(url, content, {
      { field = "Authorization", value = "Bearer " .. self.apiToken },
    })
  end)
end

function API:POST(path, content)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.apiUrl .. path
  local requestHeaders = {
    { field = "Content-Type", value = "application/json" },
  }

  local body = content
  if type(content) ~= "string" then
    success, body = Utils.jsonEncode(logger, content)
    if not success then
      return success, body
    end
  end

  return self:callServer(function ()
    return LrHttp.post(url, body, {
      { field = "Content-Type", value = "application/json" },
      { field = "Authorization", value = "Bearer " .. self.apiToken },
    })
  end)
end

function API:GET(path)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.apiUrl .. path

  return self:callServer(function ()
    return LrHttp.get(url, {
      { field = "Authorization", value = "Bearer " .. self.apiToken },
    })
  end)
end

function API:setPassword(password)
  if self.password == password then
    return
  end

  self.password = password
  self.apiToken = nil
  self.errorState = nil
  self.catalogs = {}
  self.albums = {}
end

function API:login()
  if self.apiToken ~= nil then
    return true, nil
  end

  local requestHeaders = {
    { field = "Content-Type", value = "application/json" },
  }

  local response, info = LrHttp.get(self.siteUrl .. "api/config", requestHeaders)
  local success, result = self:parseHTTPResult(response, info)
  if not success then
    return success, result
  end

  self.apiUrl = result.apiUrl .. "api/"

  local success, data = Utils.jsonEncode(logger, {
    email = self.email,
    password = self.password,
  })
  if not success then
    return success, data
  end

  local response, info = LrHttp.post(self.apiUrl .. "login", data, requestHeaders)
  local success, result = self:parseHTTPResult(response, info)

  if not success and result.code == "notLoggedIn" then
    result = {
      code = "badCredentials",
      name = LOC "$$$/LrPixelBin/API/BadCredentials=Incorrect username or password.",
    }
  end

  if success then
    self.errorState = nil
    self.apiToken = result.token

    self:refreshState()

    return true, nil
  end

  logger:error("Login failed", result.code, result.name)
  self.apiToken = nil
  self.errorState = result
  self.catalogs = nil
  self.albums = nil

  return success, self.errorState
end

function API:getMedia(ids)
  local results = {}
  local resultCount = 0

  local function lookup(idlist, count)
    if count == 0 then
      return
    end

    local success, result = self:GET("media/" .. idlist)
    if not success then
      resultCount = resultCount + count
      return
    end

    local index = 1
    while index <= count do
      results[resultCount + index] = result.media[index]
      index = index + 1
    end

    resultCount = resultCount + count
  end

  local idlist = ""
  local lookupCount = 0

  for _, id in ipairs(ids) do
    if string.len(idlist) > 0 then
      idlist = idlist .. "," .. id
    else
      idlist = id
    end

    lookupCount = lookupCount + 1

    if string.len(idlist) > 3000 then
      lookup(idlist, lookupCount)
      idlist = ""
      lookupCount = 0
    end
  end

  lookup(idlist, lookupCount)

  return results
end

function API:deleteMedia(ids)
  return self:POST("media/delete", ids)
end

function API:createAlbum(catalog, album)
  local parent
  if album.parent then
    parent = json.encode(album.parent)
  else
    parent = "null"
  end

  local body = string.format([[
    {
      "catalog": %s,
      "album": {
        "name": %s,
        "parent": %s
      }
    }
  ]], json.encode(catalog), json.encode(album.name), parent)

  local success, result = self:POST("album/create", body)
  if success then
    table.insert(self.albums, result)
  end

  return success, result
end

function API:editAlbum(id, album)
  local parent
  if album.parent then
    parent = json.encode(album.parent)
  else
    parent = "null"
  end

  local body = string.format([[
    {
      "id": %s,
      "album": {
        "name": %s,
        "parent": %s
      }
    }
  ]], json.encode(id), json.encode(album.name), parent)

  local success, result = self:POST("album/edit", body)
  if success then
    for i, album in ipairs(self.albums) do
      if album.id == result.id then
        self.albums[i] = result
      end
    end
  end

  return success, result
end

function API:deleteAlbum(album)
  return self:POST("album/delete", { album })
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

function API:removeMediaFromAlbum(album, media)
  return self:POST("media/relations", {
    {
      operation = "delete",
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

local function hasKeyword(photo, keyword)
  for _, found in ipairs(keyword:getPhotos()) do
    if found == photo then
      return true
    end
  end

  return false
end

local function findKeywords(photo, keywords, found)
  for _, keyword in ipairs(keywords) do
    if hasKeyword(photo, keyword) then
      table.insert(found, keyword)
    end

    findKeywords(photo, keyword:getChildren(), found)
  end
end

function API:extractMetadata(photo, publishSettings)
  local metadata = {
    media = {},
    tags = {},
  }

  local people = {}
  local keywords = {}
  findKeywords(photo, photo.catalog:getKeywords(), keywords)

  for _, keyword in ipairs(keywords) do
    local attributes = keyword:getAttributes()
    if attributes.includeOnExport and attributes.keywordType == "person" then
      table.insert(people, { name = keyword:getName() })
      keyword = keyword:getParent()
    end

    local hasTag = false
    local tag = {}
    while keyword do
      attributes = keyword:getAttributes()

      if not attributes.includeOnExport then
        hasTag = false
        break
      end

      table.insert(tag, 1, keyword:getName())
      hasTag = true
      keyword = keyword:getParent()
    end

    if hasTag then
      table.insert(metadata.tags, tag)
    end
  end

  local function addMetadata(metadataKey, value)
    if value == nil then
      return
    end

    if type(value) == "string" and value == "" then
      return
    end

    metadata.media[metadataKey] = value
  end

  local function addRawMetadata(metadataKey, key)
    addMetadata(metadataKey, photo:getRawMetadata(key))
  end

  local function addFormattedMetadata(metadataKey, key)
    addMetadata(metadataKey, photo:getFormattedMetadata(key))
  end

  addFormattedMetadata("filename", "fileName")
  addFormattedMetadata("title", "title")
  addFormattedMetadata("description", "caption")
  addFormattedMetadata("label", "label")
  addFormattedMetadata("category", "iptcCategory")
  addFormattedMetadata("location", "location")
  addFormattedMetadata("city", "city")
  addFormattedMetadata("state", "stateProvince")
  addFormattedMetadata("country", "country")
  addFormattedMetadata("make", "cameraMake")
  addFormattedMetadata("model", "cameraModel")
  addFormattedMetadata("lens", "lens")
  addFormattedMetadata("photographer", "artist")

  addRawMetadata("iso", "isoSpeedRating")
  addRawMetadata("aperture", "aperture")
  addRawMetadata("focalLength", "focalLength")
  addRawMetadata("shutterSpeed", "shutterSpeed")
  addRawMetadata("altitude", "gpsAltitude")
  addRawMetadata("rating", "rating")

  -- In order of preference, least accurate first.
  addRawMetadata("taken", "dateTimeDigitizedISO8601")
  addRawMetadata("taken", "dateTimeOriginalISO8601")
  addFormattedMetadata("taken", "dateCreated")

  local gps = photo:getRawMetadata("gps")
  if gps then
    addMetadata("longitude", gps.longitude)
    addMetadata("latitude", gps.latitude)
  end

  if photo:getRawMetadata("fileFormat") == "VIDEO" then
    metadata.people = people
  end

  return metadata
end

function API:uploadMetadata(photo, publishSettings, remoteId)
  local mediaInfo = self:extractMetadata(photo, publishSettings)
  mediaInfo.id = remoteId

  return self:POST("media/edit", mediaInfo)
end

function API:upload(photo, publishSettings, filePath, remoteId)
  local mediaInfo = self:extractMetadata(photo, publishSettings)

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
    mediaInfo.people = {}
    for _, person in ipairs(asList(exifdata.PersonInImage)) do
      local personInfo = {
        name = person,
      }
      table.insert(mediaInfo.people, personInfo)
      foundPeople[person] = personInfo
    end
  end

  local dimensions = photo:getRawMetadata("croppedDimensions")
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

  if remoteId then
    mediaInfo.id = remoteId
  else
    mediaInfo.catalog = publishSettings.catalog
  end

  success, data = Utils.jsonEncode(logger, mediaInfo)
  if not success then
    return success, data
  end

  local params = {
    { name = "json", value = data, contentType = "application/json" },
    { name = "file", fileName = photo:getFormattedMetadata("fileName"), filePath = filePath }
  }

  return self:MULTIPART("media/upload", params)
end

function API:refreshState()
  if self.apiToken then
    local success, result = self:GET("state")
    if success then
      self.catalogs = result.catalogs
      self.albums = result.albums
    end
  else
    self:login()
  end
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

function API:getOrCreateChildAlbum(catalog, parent, name)
  for _, album in ipairs(self:getAlbumsWithParent(catalog, parent)) do
    if string.lower(album.name) == string.lower(name) then
      return true, album
    end
  end

  return self:createAlbum(catalog, {
    name = name,
    parent = parent,
  })
end

local instances = { }

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
    apiUrl = settings.siteUrl .. "api/",
    email = settings.email,
    password = settings.password,
    apiToken = nil,
    loggedIn = false,
    errorState = nil,
    catalogs = {},
    albums = {},
  }
  setmetatable(api, { __index = API })
  instances[key] = api

  return api
end

return get
