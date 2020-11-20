return {
  LrSdkVersion = 7.0,
  LrSdkMinimumVersion = 7.0,

  LrToolkitIdentifier = "org.pixelbin.lrpixelbin",

  LrPluginName = LOC "$$$/LrPixelBin/PluginName=LrPixelBin",
  LrPluginInfoUrl = "https://pixelbin.org",

  LrInitPlugin = "Init.lua",

  LrExportMenuItems = {
    {
      title = "Reload Categories and Albums",
      file = "Refresh.lua",
    },
    {
      title = "Re-upload Metadata",
      file = "UploadMetadata.lua",
      enabledWhen = "anythingSelected",
    },
  },

  LrExportServiceProvider = {
    title = "PixelBin",
    file = "Provider.lua",
  },

  VERSION = { major=0, minor=1, revision=0, build=0, },
}
