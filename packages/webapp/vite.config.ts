import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
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
          route("/catalog/:id", "routes/catalog/layout.tsx", () => {
            route("", "routes/catalog/index.tsx", { index: true });
            route("media/:media", "routes/catalog/media.tsx", { index: true });
          });
          route("/album/:id", "routes/album/layout.tsx", () => {
            route("", "routes/album/index.tsx", { index: true });
            route("media/:media", "routes/album/media.tsx", { index: true });
          });
          route("/search/:id", "routes/search/layout.tsx", () => {
            route("", "routes/search/index.tsx", { index: true });
            route("media/:media", "routes/search/media.tsx", { index: true });
          });
          route("/api/:type/:id/media", "api/gallery.ts");
          route("/media/*", "api/media.ts");
          route("/login", "actions/login.ts");
          route("/logout", "actions/logout.ts");
        });
      },
    }),
    tsconfigPaths(),
  ],
});
