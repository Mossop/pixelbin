import {
  type RouteConfig,
  route,
  index,
  RouteConfigEntry,
} from "@react-router/dev/routes";

function galleryRoutes(type: string): RouteConfigEntry {
  return route(`/${type}/:id`, `routes/galleries/${type}.tsx`, [
    route("media/:media", "routes/media.tsx", {
      index: true,
      id: `routes/${type}/media`,
    }),
  ]);
}

export default [
  index("routes/index.tsx"),

  route("/catalog/:id/search", "routes/search.tsx", [
    route("media/:media", "routes/media.tsx", {
      index: true,
      id: `routes/customsearch/media`,
    }),
  ]),

  galleryRoutes("catalog"),
  galleryRoutes("album"),
  galleryRoutes("search"),

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
