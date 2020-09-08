local LrHttp = import "LrHttp"

local json = require "json"

local logger = require("Logging")("API")

local API = { }

function API:updateCSRF(headers)
  for _, header in ipairs(headers) do
    if header["field"] == "Set-Cookie" then
      cookie = LrHttp.parseCookie(header["value"])
      if cookie["csrftoken"] ~= nil then
        self.csrf_token = cookie["csrftoken"]
        return
      end
    end
  end
end

function API:GET(path, params)
  local url = self.siteUrl .. "api/" .. path

  logger:trace("Calling GET API", url)
  local result, headers = LrHttp.get(url, params)

  if result == nil then
    return false, "An error occured calling API " .. path .. ": " .. headers["info"]["name"]
  end

  if headers["status"] ~= 200 then
    return false, "Failed to perform API method " .. path .. ": " .. headers["status"]
  end

  self:updateCSRF(headers)

  return true, json.decode(result)
end

function API:POST(path, method, body)
  local url = self.siteUrl .. "api/" .. path

  local requestHeaders = { }

  local encoded = ""
  if body ~= nil then
    encoded = json.encode(body)

    table.insert(requestHeaders, { field = "Content-Type", value = "application/json" })
  end

  logger:trace("Calling POST API", url, requestHeaders)
  local response, responseHeaders = LrHttp.post(url, encoded, requestHeaders)

  if response == nil then
    logger:trace("Error", responseHeaders)

    return false
  end

  if responseHeaders.status ~= 200 then
    logger:trace("Bad status", responseHeaders)

    return false
  end

  return true, json.decode(result)
end

function API:setState(state)
  self.errorState = nil
  self.catalogs = state.user.catalogs
  self.albums = state.user.albums
end

function API:setError(error)
  self.errorState = error
  self.catalogs = nil
  self.albums = nil
end

function API:login()
  local requestHeaders = {
    { field = "Content-Type", value = "application/json" },
  }

  logger:trace("Attempting to login")
  local result, info = LrHttp.post(self.siteUrl .. "api/login", json.encode({
    email = self.email,
    password = self.password,
  }), requestHeaders)

  if not result then
    logger:error("Connection to server failed", info.error.errorCode, info.error.name)

    if info.error.errorCode == "badURL" then
      self:setError({ code = "invalidUrl", name = info.error.name })
    elseif info.error.errorCode == "cannotFindHost" then
      self:setError({ code = "unknownHost", name = info.error.name })
    else
      self:setError({ code = "connection", name = info.error.name })
    end

    return false
  end

  if info.status == 200 then
    logger:trace("Login success", result)
    self:setState(json.decode(result))
    return true
  end

  if info.status == 401 then
    self:setError({
      code = "badCredentials",
      name = LOC "$$$/LrPixelBin/API/BadCredentials=Incorrect username or password.",
    })

    return false
  end

  logger:error("Unexpected response from server", result, json.encode(info))
  self:setError({
    code = "unknown",
    name = LOC "$$$/LrPixelBin/API/Unknown=An unknown error occured."
  })

  return false
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

function API:upload(photo, path)
  local tags = ""
  local keywords = photo:getRawMetadata("keywords")
  for _, keyword in ipairs(keywords) do
    if includeInExport(keyword) then
      paths = getTagPaths(keyword)
      for _, path in ipairs(paths) do
        tags = tags .. path .. ","
      end
    end
  end

  local params = {
    { name = "tags", value = tags },
    { name = "file", fileName = "photo.jpg", filePath = path }
  }

  logger:trace("Uploading", json.encode(params))
  local success, result = self:POST("upload", params)
  if success then
    return true, result["media"]
  end
  return success, result
end

function API:delete(ids)
  return self:POST("delete", {
    { name = "ids", value = json.encode(ids) }
  })
end

function API:refresh()
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
  if self.cacheCount <= 0 then
    instances[self.instanceKey] = nil
  end
end

local function get(siteUrl, email, password)
  local key = siteUrl .. "#" .. email
  if instances[key] ~= nil then
    return instances[key]
  end

  local api = {
    instanceKey = key,
    loggedIn = false,
    cacheCount = 0,
    siteUrl = siteUrl,
    email = email,
    password = password,
    valid = false,
    catalogs = {},
    albums = {},
  }
  setmetatable(api, { __index = API })

  api:login()

  return api
end

return get
