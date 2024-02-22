# Pixelbin

Personal media storage with advanced search and sharing functionality.

The key differentiator between this and other available media hosting systems are that it defaults
to storing the bulk of the media in S3 (or compatible) buckets allowing for extremely low cost
storage for large amounts of data. This does come with the trade-off that actually accessing the
media files comes with increased latency.

This is a complete reimplementation of the [previous version](https://github.com/Mossop/pixelbin/tree/js-server) **AND IS NOT YET USABLE**!

It is split into three parts.

* [service](/packages/service) is a Rust based API service that acts as an API server and requires
  a postgres database for backend storage.
* [LrPixelbin.lrplugin](/packages/LrPixelbin.lrplugin) is a Lightroom Classic plugin that handles
  uploading photos and videos to the service.
* [webapp](/packages/webapp) is a web app build with [Next.js](https://nextjs.org/) to allow
  browsing the media.
