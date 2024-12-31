import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),

  route("/catalog/:id", "routes/galleries/catalog/index.tsx", [
    route("media/:media", "routes/galleries/catalog/media.tsx"),
  ]),
  route("/album/:id", "routes/galleries/album/index.tsx", [
    route("media/:media", "routes/galleries/album/media.tsx"),
  ]),
  route("/search/:id", "routes/galleries/savedsearch/index.tsx", [
    route("media/:media", "routes/galleries/savedsearch/media.tsx"),
  ]),
  route("/catalog/:id/search", "routes/galleries/customsearch/index.tsx", [
    route("media/:media", "routes/galleries/customsearch/media.tsx"),
  ]),

  route("/api/:container/:id/:type", "api/gallery.ts"),
  route("/api/config", "api/config.ts"),
  route("/search/subscribe", "api/subscribe.ts"),
  route("/search/unsubscribe", "api/unsubscribe.ts"),
  route("/media/*", "api/media.ts"),
  route("/login", "actions/login.ts"),
  route("/logout", "actions/logout.ts"),
  route("/markPublic", "actions/markPublic.ts"),
  route("/*", "routes/notfound.tsx"),
] satisfies RouteConfig;
