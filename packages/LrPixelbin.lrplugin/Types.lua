---@meta

---@class Album
---@field id string
---@field catalog string
---@field name string
---@field parent string | nil
local Album = {}

---@class AlbumUpdate
---@field name string
---@field parent string | nil
local Album = {}

---@class Catalog
---@field id string
---@field name string
local Catalog = {}

---@class Media
local Media = {}

---@class PublishSettings
---@field siteUrl string
---@field email string
---@field password string
---@field catalog string
local PublishSettings = {}

---@class RenditionInfo
---@field remoteId string|nil
---@field rendition LrExportRendition
---@field needsUpload boolean
---@field inAlbum boolean
local RenditionInfo = {}

---@alias SubAlbums
---| "none"
---| "catalog"
---| "custom"
