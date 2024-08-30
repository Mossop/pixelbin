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
local AlbumUpdate = {}

---@class AlbumRelation
---@field id string
---@field name string
local AlbumRelation = {}

---@class TagRelation
---@field id string
---@field name string
local TagRelation = {}

---@class Catalog
---@field id string
---@field name string
local Catalog = {}

---@class Location
---@field left number
---@field right number
---@field top number
---@field bottom number
local Location = {}

---@class PersonRelation
---@field id string
---@field name string
---@field location Location?
local PersionRelation = {}

---@class MediaFile
local MediaFile = {}

---@class Media
---@field id string
---@field catalog string
---@field file MediaFile?
---@field albums AlbumRelation[]
---@field tags TagRelation[]
---@field people PersonRelation[]
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

---@class CollectionSettings
---@field subalbums SubAlbums
---@field pathstrip number
local CollectionSettings = {}

---@class TargetAlbum
---@field root string
---@field names string[]?
local TargetAlbum = {}
