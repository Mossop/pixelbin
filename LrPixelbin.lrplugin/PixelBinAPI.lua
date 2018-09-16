local LrLogger = import "LrLogger"
local LrHttp = import "LrHttp"
local LrDialogs = import "LrDialogs"

json = require "json"

local logger = LrLogger("PixelBinAPI")
logger:enable("print")

local API = { }

function API:POST(path, params)
  if self.csrf_token == nil then
    error("Attempt to invoke API method " .. path .. " without CSRF token.")
  end

  local request_headers = { }
  table.insert(request_headers, { field = "X-CSRFToken", value = self.csrf_token })
  url = self.site_url .. "api/" .. path

  logger:trace("Calling API " .. url)
  local result, headers = LrHttp.postMultipart(url, params, request_headers)

  if result == nil then
    return false, "An error occured calling API " .. path .. ": " .. headers["info"]["name"]
  end

  if headers["status"] ~= 200 then
    return false, "Failed to perform API method " .. path .. ": " .. headers["status"]
  end

  return true, json.decode(result)
end

function API:login(email, password)
  logger:trace("Retrieving " .. self.site_url)
  local result, headers = LrHttp.get(self.site_url)

  if result == nil then
    return false, "An error occured while trying to log in. " .. headers["info"]["name"]
  end

  if headers["status"] ~= 200 then
    return false, "Failed to log in for an unexpected reason. Status: " .. headers["status"]
  end

  self.csrf_token = nil
  for _, header in ipairs(headers) do
    if header["field"] == "Set-Cookie" then
      cookie = LrHttp.parseCookie(header["value"])
      if cookie["csrftoken"] ~= nil then
        self.csrf_token = cookie["csrftoken"]
      end
    end
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

function PixelBinAPI(site_url)
  api = { site_url = site_url }
  setmetatable(api, { __index = API })
  return api
end
