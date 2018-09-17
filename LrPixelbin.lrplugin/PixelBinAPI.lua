local LrLogger = import "LrLogger"
local LrHttp = import "LrHttp"
local LrDialogs = import "LrDialogs"
local LrDate = import "LrDate"

json = require "json"

local logger = LrLogger("PixelBinAPI")
logger:enable("print")

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
  url = self.site_url .. "api/" .. path

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

function API:POST(path, params)
  if self.csrf_token == nil then
    error("Attempt to invoke API method " .. path .. " without CSRF token.")
  end

  local request_headers = {
    { field = "X-CSRFToken", value = self.csrf_token }
  }
  url = self.site_url .. "api/" .. path

  logger:trace("Calling POST API", url, json.encode(request_headers))
  local result, headers = LrHttp.postMultipart(url, params, request_headers)

  if result == nil then
    return false, "An error occured calling API " .. path .. ": " .. headers["info"]["name"]
  end

  if headers["status"] ~= 200 then
    return false, "Failed to perform API method " .. path .. ": " .. headers["status"]
  end

  self:updateCSRF(headers)

  return true, json.decode(result)
end

function API:login(email, password)
  self.csrf_token = nil
  success, result = self:GET("dummy", { })

  if not success then
    return false, result
  end

  if self.csrf_token == nil then
    return false, "Unable to obtain CSRF token."
  end

  local success, result = self:POST("login", {
    { name = "email", value = email },
    { name = "password", value = password }
  })

  if not success then
    return false, "An error occurred while trying to log in. " .. result
  end

  logger:info("Logged in!")
  return true
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

  local timestamp = photo:getRawMetadata("dateTimeOriginal")

  local params = {
    { name = "tags", value = tags },
    { name = "date", value = LrDate.timeToUserFormat(timestamp, "%Y-%m-%dT%H:%M:%S") },
    { name = "file", fileName = "photo.jpg", filePath = path }
  }

  local gps = photo:getRawMetadata("gps")
  if gps then
    table.insert(params, { name = "latitude", value = gps["latitude"] })
    table.insert(params, { name = "longitude", value = gps["longitude"] })
  end

  logger:trace("Uploading", json.encode(params))
  local success, result = self:POST("upload", params)
  if success then
    return true, result["media"]
  end
  return success, result
end

function API:delete(id)
  return self:POST("delete", {
    { name = "id", value = id }
  })
end

function API:logout()
  self:GET("logout", { })
end

function PixelBinAPI(site_url)
  api = { site_url = site_url }
  setmetatable(api, { __index = API })
  return api
end
