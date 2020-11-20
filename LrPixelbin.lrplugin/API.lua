local LrHttp = import "LrHttp"
local LrTasks = import "LrTasks"

local json = require "json"
local utf8 = require "utf8"

local logger = require("Logging")("API")
local Utils = require "Utils"

local API = { }

local CSRF_HEADER = "X-CSRFToken";

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

  local url = self.siteUrl .. "api/" .. path

  return self:callServer(function ()
    return LrHttp.postMultipart(url, content, {
      { field = CSRF_HEADER, value = self.csrfToken },
    })
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
      { field = CSRF_HEADER, value = self.csrfToken },
    })
  end)
end

function API:GET(path)
  local success, result = self:login()
  if not success then
    return success, result
  end

  local url = self.siteUrl .. "api/" .. path

  return self:callServer(function ()
    return LrHttp.get(url, {
      { field = CSRF_HEADER, value = self.csrfToken },
    })
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
    self.csrfToken = nil

    for _, header in ipairs(info) do
      if string.lower(header.field) == string.lower(CSRF_HEADER) then
        self.csrfToken = header.value
      end
    end

    if not self.csrfToken then
      return false, {
        code = "noCsrfToken",
        name = LOC "$$$/LrPixelBin/API/BadHeaders=Np CSRF token was provided by the server."
      }
    end

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

function API:extractMetadata(photo, publishSettings)
  local metadata = {}

  local function addMetadata(metadataKey, value)
    if value == nil then
      return
    end

    if type(value) == "string" and value == "" then
      return
    end

    metadata[metadataKey] = value
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
  addFormattedMetadata("taken", "dateCreated")
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
  addRawMetadata("altitude", "gpsAltitude")
  addRawMetadata("rating", "rating")

  local gps = photo:getRawMetadata("gps")
  if gps then
    addMetadata("longitude", gps.longitude)
    addMetadata("latitude", gps.latitude)
  end

  local function decodeCharacter(val)
    if val == 0xB9 then
      return "1"
    end

    if val == 0xB2 then
      return "2"
    end

    if val == 0xB3 then
      return "3"
    end

    if val == 0x2070 then
      return "0"
    end

    if val >= 0x2074 and val <= 0x2079 then
      return tostring(val - 0x2070)
    end

    if val >= 0x2080 and val <= 0x2089 then
      return tostring(val - 0x2080)
    end

    if val == 0x2044 then
      return "/"
    end

    return string.char(val)
  end

  local function convertShutterSpeed(shutterSpeed)
    local decoded = ""
    local ch = 1
    local val

    while ch <= string.len(shutterSpeed) do
      ch, val = utf8.next(shutterSpeed, ch)
      if val == 0x20 then
        return decoded
      end
      decoded = decoded .. decodeCharacter(val)
    end

    return decoded
  end

  local shutterSpeed = photo:getFormattedMetadata("shutterSpeed")
  if shutterSpeed ~= nil then
    metadata.shutterSpeed = convertShutterSpeed(shutterSpeed)
  end

  return metadata
end

function API:uploadMetadata(photo, publishSettings, remoteId)
  local mediaInfo = {
    id = remoteId,
    media = self:extractMetadata(photo, publishSettings),
  }

  return self:POST("media/edit", mediaInfo)
end

function API:upload(photo, publishSettings, filePath, remoteId)
  local mediaInfo = {
    media = self:extractMetadata(photo, publishSettings),
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

      if foundPeople[tag[depth]] then
        table.remove(tag)
        depth = depth - 1
      end

      if depth > 0 then
        table.insert(mediaInfo.tags, tag)
      end
    end
  elseif exifdata.Subject then
    for _, tag in ipairs(asList(exifdata.Subject)) do
      if not foundPeople[tag] then
        table.insert(mediaInfo.tags, { tag })
      end
    end
  elseif exifdata.Keywords then
    for _, tag in ipairs(asList(exifdata.Keywords)) do
      if not foundPeople[tag] then
        table.insert(mediaInfo.tags, { tag })
      end
    end
  end

  if remoteId then
    mediaInfo.id = remoteId
    path = "media/edit"
  else
    mediaInfo.catalog = publishSettings.catalog
    path = "media/create"
  end

  success, data = Utils.jsonEncode(logger, mediaInfo)
  if not success then
    return success, data
  end

  local params = {
    { name = "json", value = data },
    { name = "file", fileName = photo:getFormattedMetadata("fileName"), filePath = filePath }
  }

  return self:MULTIPART(path, params)
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
    email = settings.email,
    password = settings.password,
    csrfToken = nil,
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
