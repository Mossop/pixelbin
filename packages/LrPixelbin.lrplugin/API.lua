local LrHttp = import "LrHttp"
local LrTasks = import "LrTasks"
local LrApplication = import "LrApplication"
local LrPathUtils = import "LrPathUtils"

local json = require "json"

local logger = require("Logging")("API")
local Utils = require "Utils"

---@param url string
---@return string
local function logUrl(url)
  if string.len(url) > 100 then
    return string.sub(url, 1, 97) .. "..."
  end

  return url
end

---@class API
---@field private instanceKey string
---@field private cacheCount number
---@field private siteUrl string
---@field private apiUrl string
---@field private email string
---@field private password string
---@field private apiToken string | nil
---@field private errorState Error | nil
---@field private catalogs { [string]: Catalog }
---@field private albums { [string]: Album }
---@field private children { [string]: { [string]: boolean } }
local API = {}

---@param album Album
function API:setChild(album)
  local parent = album.parent
  if not parent then
    parent = album.catalog
  end

  local childList = self.children[parent]
  if not childList then
    childList = {}
    self.children[parent] = childList
  end

  childList[album.id] = true
end

---@param album Album
function API:removeChild(album)
  local parent = album.parent
  if not parent then
    parent = album.catalog
  end

  local childList = self.children[parent]
  if not childList then
    return
  end

  childList[album.id] = nil
end

---@private
---@param response string
---@param info table
---@return any | Error
function API:parseHTTPResult(response, info)
  if not response then
    logger:error("Connection to server failed", info.error.errorCode, info.error.name)

    if info.error.errorCode == "badURL" then
      return Utils.throw("invalidUrl", info.error.name)
    elseif info.error.errorCode == "cannotFindHost" then
      return Utils.throw("unknownHost", info.error.name)
    else
      return Utils.throw("connection", info.error.name)
    end
  end

  if info.status == 200 then
    return Utils.jsonDecode(logger, response)
  end

  if info.status == 401 then
    self.apiToken = nil
    return Utils.throw("notLoggedIn", info.error.name)
  end

  if info.status == 413 then
    return Utils.throw("tooLarge", info.error.name)
  end

  if info.status == 404 then
    return Utils.throw("notFound", info.error.name)
  end

  if info.status == 503 then
    return Utils.throw("backoff", info.error.name)
  end

  local result = Utils.jsonDecode(logger, response)
  if Utils.isSuccess(result) and result.code then
    result = Utils.result(result)
    if result.data and result.data.message then
      return Utils.throw(result.code, result.data.message)
    end

    return Utils.throw(result.code)
  end

  logger:error("Unexpected response from server", response)

  return Utils.throw("unknown")
end

---@private
---@param cb fun(): string, table
---@return any | Error
function API:callServer(cb)
  local attemptCount = 0
  repeat
    attemptCount = attemptCount + 1
    local response, info = cb()
    local result = self:parseHTTPResult(response, info)

    if Utils.isSuccess(result) then
      return result
    end

    if result.code == "notLoggedIn" then
      if attemptCount == 2 then
        logger:error("Logged out and log in failed. Giving up.")
        return result
      end

      logger:info("Logged out, attempting to log in.")
      result = self:login()
      if Utils.isError(result) then
        return result
      end
    elseif result.code == "backoff" then
      if attemptCount == 10 then
        logger:error("Instructed to back off 10 times. Giving up.")
        return result
      end

      logger:info("Received backoff status from server. Sleeping for 20 seconds.")
      LrTasks.sleep(10)
    else
      return result
    end

    ---@diagnostic disable-next-line: missing-return
  until false
end

---@private
---@param path string
---@param content table
---@return any | Error
function API:MULTIPART(path, content)
  local result = self:login()
  if Utils.isError(result) then
    return result
  end

  local url = self.apiUrl .. path
  logger:trace("MULTIPART", logUrl(url))

  return self:callServer(function()
    return LrHttp.postMultipart(url, content, {
      { field = "Authorization", value = "Bearer " .. self.apiToken },
    })
  end)
end

---@private
---@param path string
---@param content string | table
---@return any | Error
function API:POST(path, content)
  local result = self:login()
  if Utils.isError(result) then
    return result
  end

  local url = self.apiUrl .. path
  logger:trace("POST", logUrl(url))

  local body = content
  if type(content) ~= "string" then
    local encoded = Utils.jsonEncode(logger, content)
    if Utils.isSuccess(encoded) then
      body = encoded
    else
      return encoded
    end
  end

  return self:callServer(function()
    return LrHttp.post(url, body, {
      { field = "Content-Type",  value = "application/json" },
      { field = "Authorization", value = "Bearer " .. self.apiToken },
    })
  end)
end

---@private
---@param path string
---@return any | Error
function API:GET(path)
  local result = self:login()
  if Utils.isError(result) then
    return result
  end

  local url = self.apiUrl .. path
  logger:trace("GET", logUrl(url))

  return self:callServer(function()
    return LrHttp.get(url, {
      { field = "Authorization", value = "Bearer " .. self.apiToken },
    })
  end)
end

---@param password string
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

---@return boolean | Error
function API:login()
  if self.apiToken ~= nil then
    return true
  end

  local requestHeaders = {
    { field = "Content-Type", value = "application/json" },
  }

  local response, info = LrHttp.get(self.siteUrl .. "api/config", requestHeaders)
  local result = self:parseHTTPResult(response, info)
  if Utils.isError(result) then
    return result
  end

  self.apiUrl = result.apiUrl .. "api/"

  result = Utils.jsonEncode(logger, {
    email = self.email,
    password = self.password,
  })

  if Utils.isError(result) then
    return Utils.error(result)
  end

  response, info = LrHttp.post(self.apiUrl .. "login", result, requestHeaders)
  result = self:parseHTTPResult(response, info)

  if Utils.isError(result) and result.code == "notLoggedIn" then
    result = Utils.throw("badCredentials")
  end

  if Utils.isSuccess(result) then
    self.errorState = nil
    self.apiToken = result.token

    self:refreshState()

    return true
  end

  logger:error("Login failed", result.code)
  self.apiToken = nil
  self.errorState = result
  self.catalogs = nil
  self.albums = nil

  return result
end

---@param ids string[]
---@param progressCallback fun(count: number)?
---@return { [string]: Media }
function API:getMedia(ids, progressCallback)
  local results = {}

  local function lookup(idlist, count)
    if count == 0 then
      return
    end

    local result = self:GET("media/" .. idlist)
    if Utils.isError(result) then
      return
    end

    for _, mediaItem in ipairs(result.media) do
      results[mediaItem.id] = mediaItem
    end

    if progressCallback then
      progressCallback(count)
    end
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

---@param ids string[]
---@return nil | Error
function API:deleteMedia(ids)
  return self:POST("media/delete", ids)
end

---@param catalog string
---@param album AlbumUpdate
---@return Album | Error
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

  local result = self:POST("album/create", body)
  if Utils.isSuccess(result) then
    self.albums[result.id] = result
    self.children[result.parent][result.id] = true
  end

  return result
end

---@param id string
---@param album AlbumUpdate
---@return Album | Error
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

  local result = self:POST("album/edit", body)
  if Utils.isSuccess(result) then
    self:removeChild(self.albums[id])
    self.albums[id].name = result.name
    self.albums[id].parent = result.parent
    self:setChild(self.albums[id])
  end

  return result
end

---@param album string
---@return nil | Error
function API:deleteAlbum(album)
  return self:POST("album/delete", { album })
end

---@param album string
---@param media string[]
---@return nil | Error
function API:addMediaToAlbum(album, media)
  return self:POST("album/media", {
    {
      operation = "add",
      media = media,
      album = album,
    },
  })
end

---@param album string
---@param media string[]
---@return nil | Error
function API:removeMediaFromAlbum(album, media)
  return self:POST("album/media", {
    {
      operation = "delete",
      media = media,
      album = album,
    },
  })
end

---@param val string | table
---@return table
local function asList(val)
  if type(val) ~= "table" then
    return { val }
  end
  return val
end

---@param photo LrPhoto
---@param keyword LrKeyword
---@return boolean
local function hasKeyword(photo, keyword)
  for _, found in ipairs(keyword:getPhotos()) do
    if found == photo then
      return true
    end
  end

  return false
end

---@param photo LrPhoto
---@param keywords LrKeyword[]
---@param found LrKeyword[]
local function findKeywords(photo, keywords, found)
  for _, keyword in ipairs(keywords) do
    if hasKeyword(photo, keyword) then
      table.insert(found, keyword)
    end

    findKeywords(photo, keyword:getChildren(), found)
  end
end

---@param photo LrPhoto
---@param publishSettings PublishSettings
---@return table
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

---@param photo LrPhoto
---@param publishSettings PublishSettings
---@param remoteId string
---@return nil | Error
function API:uploadMetadata(photo, publishSettings, remoteId)
  local mediaInfo = self:extractMetadata(photo, publishSettings)
  mediaInfo.id = remoteId

  return self:POST("media/edit", mediaInfo)
end

---@param publishSettings PublishSettings
---@return { id: string } | Error
function API:create(publishSettings)
  local mediaInfo = {
    catalog = publishSettings.catalog
  }

  return self:POST("media/create", mediaInfo)
end

---@param photo LrPhoto
---@return { id: string } | Error
function API:upload(photo, publishSettings, filePath, remoteId)
  local mediaInfo = self:extractMetadata(photo, publishSettings)
  mediaInfo.id = remoteId

  local exiftool = _PLUGIN.path .. "/Image-ExifTool/" .. "exiftool"
  local target = os.tmpname()

  local result = LrTasks.execute(exiftool .. " -json " .. filePath .. " > " .. target)
  if result ~= 0 then
    return Utils.throw("exiftoolError")
  end

  local handle, error, code = io.open(target, "r")
  if not handle then
    return Utils.throw("badfile", { error or "unknown" })
  end

  local data = handle:read("*all")
  handle:close()

  local exifdata = Utils.jsonDecode(logger, data)
  if Utils.isError(exifdata) then
    return exifdata
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

  data = Utils.jsonEncode(logger, mediaInfo)
  if Utils.isError(data) then
    return Utils.error(data)
  end

  local params = {
    { name = "json", value = data,                                      contentType = "application/json" },
    { name = "file", fileName = photo:getFormattedMetadata("fileName"), filePath = filePath }
  }

  return self:MULTIPART("media/upload", params)
end

---@generic T
---@param list T[]
---@return { [string]: T }
local function intoMap(list)
  local result = {}

  for _, item in ipairs(list) do
    result[item.id] = item
  end

  return result
end

function API:refreshState()
  if self.apiToken then
    local result = self:GET("state")
    if Utils.isSuccess(result) then
      self.catalogs = intoMap(result.catalogs)
      self.albums = intoMap(result.albums)
      self.children = {}

      for _, album in pairs(self.albums) do
        self:setChild(album)
      end
    end
  else
    self:login()
  end
end

function API:logout()
  self:GET("logout")
end

---@return nil | Error
function API:error()
  return self.errorState
end

---@return Catalog[]
function API:getCatalogs()
  local result = {}

  for _, c in pairs(self.catalogs) do
    table.insert(result, c)
  end

  return result
end

---@param id string
---@return Catalog | nil
function API:getCatalog(id)
  if not self.catalogs then
    return nil
  end

  return self.catalogs[id]
end

---@param catalog string
---@param parent string | nil
---@return fun(): Album | nil
function API:getAlbumsWithParent(catalog, parent)
  if not parent then
    parent = catalog
  end

  local table = {}
  if self.children[parent] then
    table = self.children[parent]
  end

  local inner, state, var = pairs(table)
  local function iter()
    var = inner(state, var)
    if var ~= nil then
      return self.albums[var]
    end
  end

  return iter
end

---@private
---@param catalog string
---@param parent string | nil
---@param name string
---@param create boolean
---@return Album | nil | Error
function API:getChildAlbum(catalog, parent, name, create)
  for album in self:getAlbumsWithParent(catalog, parent) do
    if string.lower(album.name) == string.lower(name) then
      return album
    end
  end

  if create then
    return self:createAlbum(catalog, {
      name = name,
      parent = parent,
    })
  end

  return nil
end

---@param path string
---@return string[]
function API:getCatalogFolderPath(path)
  local catalog = LrApplication.activeCatalog()
  local folders = catalog:getFolders()

  local parts = {}
  while path do
    for _, folder in ipairs(folders) do
      if folder:getPath() == path then
        table.insert(parts, 1, LrPathUtils.leafName(path))
        return parts
      end
    end

    table.insert(parts, 1, LrPathUtils.leafName(path))
    path = LrPathUtils.parent(path)
  end

  logger:warn("Found no root folder for photo", path)
  return {}
end

---@param path string
---@return string[]
function API:getFilesystemPath(path)
  local parts = {}

  local leaf = LrPathUtils.leafName(path)
  path = LrPathUtils.parent(path)
  while path do
    table.insert(parts, 1, leaf)
    leaf = LrPathUtils.leafName(path)
    path = LrPathUtils.parent(path)
  end

  return parts
end

---@param collectionInfo table
---@param albumId string | nil
---@param photo LrPhoto
---@return TargetAlbum | nil
function API:targetAlbumForPhoto(collectionInfo, albumId, photo)
  if collectionInfo.isDefaultCollection then
    return nil
  end

  ---@type CollectionSettings
  local collectionSettings = collectionInfo.collectionSettings
  local subalbums = collectionSettings.subalbums
  local pathstrip = collectionSettings.pathstrip

  local result = {
    root = albumId,
    names = {},
  }

  if collectionSettings.subalbums == "none" then
    return result
  end

  local photoPath = LrPathUtils.parent(photo:getRawMetadata("path"))

  if subalbums == "catalog" then
    result.names = self:getCatalogFolderPath(photoPath)
  else
    result.names = self:getFilesystemPath(photoPath)
  end

  local strip = pathstrip
  while strip > 0 do
    table.remove(result.names, 1)
    strip = strip - 1
  end

  return result
end

---@private
---@param catalog string
---@param target TargetAlbum | nil
---@param create boolean
---@return { included: string | nil, excluded: { [string]: boolean } } | Error
function API:determineAlbums(catalog, target, create)
  local result = {
    included = nil,
    excluded = {},
  }

  if target == nil then
    return result
  end

  ---@type string | nil
  local album = target.root

  if target.names then
    for _, name in ipairs(target.names) do
      local childAlbum = self:getChildAlbum(catalog, album, name, create)
      if Utils.isError(childAlbum) then
        return Utils.error(childAlbum)
      end

      if childAlbum == nil then
        album = nil
        break
      end

      album = childAlbum.id
    end

    ---@param parent string
    local function excludeChildren(parent)
      for child in self:getAlbumsWithParent(catalog, parent) do
        excludeChildren(child.id)

        if child.id ~= album then
          result.excluded[child.id] = true
        end
      end
    end

    excludeChildren(target.root)
  end

  result.included = album

  return result
end

---@param catalog string
---@param mediaId string
---@param target TargetAlbum | nil
---@return { publishedId: string, publishedPath: string } | Error
function API:placeInAlbum(catalog, mediaId, target)
  if target == nil then
    return {
      publishedId = catalog,
      publishedPath = "catalog/" .. catalog .. "/media/" .. mediaId,
    }
  end

  local where = self:determineAlbums(catalog, target, true)
  if Utils.isError(where) then
    return Utils.error(where)
  end

  local operations = {}

  table.insert(operations, {
    operation = "add",
    media = mediaId,
    album = where.included,
  })

  for album, _ in pairs(where.excluded) do
    table.insert(operations, {
      operation = "delete",
      media = mediaId,
      album = album,
    })
  end

  local response = self:POST("album/media", operations)
  if Utils.isError(response) then
    return response
  end

  return {
    publishedId = where.included .. "/" .. mediaId,
    publishedPath = "album/" .. where.included .. "/media/" .. mediaId,
  }
end

---@param catalog string
---@param media Media
---@param target TargetAlbum | nil
---@return string | nil
function API:isInCorrectAlbums(catalog, media, target)
  if target == nil then
    return catalog
  end

  local where = self:determineAlbums(catalog, target, false)
  if Utils.isError(where) then
    return nil
  end

  local result = nil
  for _, album in ipairs(media.albums) do
    if album.id == where.included then
      result = where.included .. "/" .. media.id
    end

    if where.excluded[album.id] then
      return nil
    end
  end

  return result
end

---@return boolean
function API:authenticated()
  return self.apiToken ~= nil
end

---@type { [string]: API }
local instances = {}

---@param settings PublishSettings
---@return API
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
    errorState = nil,
    catalogs = {},
    albums = {},
  }
  setmetatable(api, { __index = API })
  instances[key] = api

  return api
end

return get
