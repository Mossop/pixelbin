import { RemixBrowser } from "@remix-run/react";
import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
import { registerIconLibrary } from "@shoelace-style/shoelace/dist/utilities/icon-library.js";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

import "@shoelace-style/shoelace/dist/components/badge/badge.js";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/dialog/dialog.js";
import "@shoelace-style/shoelace/dist/components/drawer/drawer.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/tag/tag.js";

setBasePath("https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.14.0/cdn");

registerIconLibrary("material", {
  resolver: (name) =>
    `https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`,
  mutator: (svg) => svg.setAttribute("fill", "currentColor"),
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>,
  );
});
