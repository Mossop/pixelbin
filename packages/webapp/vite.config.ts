import { vitePlugin as remix } from "@remix-run/dev";
import { DefineRouteFunction } from "@remix-run/dev/dist/config/routes";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function galleryRoutes(route: DefineRouteFunction, type: string) {
  route(`/${type}/:id`, `routes/${type}/layout.tsx`, () => {
    // route("", "routes/gallery.tsx", {
    //   index: true,
    //   id: `routes/${type}/gallery`,
    // });
    route("media/:media", "routes/media.tsx", {
      index: true,
      id: `routes/${type}/media`,
    });
  });
}

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
      routes(defineRoutes) {
        return defineRoutes((route) => {
          route("/", "routes/index.tsx", { index: true });
          galleryRoutes(route, "catalog");
          galleryRoutes(route, "album");
          galleryRoutes(route, "search");
          route("/api/:type/:id/media", "api/gallery.ts");
          route("/api/config", "api/config.ts");
          route("/media/*", "api/media.ts");
          route("/login", "actions/login.ts");
          route("/logout", "actions/logout.ts");
        });
      },
    }),
    tsconfigPaths(),
  ],
});
