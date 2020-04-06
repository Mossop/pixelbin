import React, { Fragment } from "react";
import { render as reactRender } from "react-dom";
import { Provider } from "react-redux";
import { JsonDecoder } from "ts.data.json";
import "core-js/stable";
import "regenerator-runtime/runtime";

import LocalizationContext from "./l10n";
import Overlay from "./overlays";
import Page from "./pages";
import store from "./store";
import { decode } from "./utils/decoders";

export interface Paths {
  static: string;
}

export const PathsDecoder = JsonDecoder.object<Paths>(
  {
    static: JsonDecoder.string,
  },
  "Paths",
);

let PATHS: Paths = {
  static: "/static/",
};

let pathsElement = document.getElementById("paths");
if (pathsElement?.textContent) {
  try {
    PATHS = decode(PathsDecoder, JSON.parse(pathsElement.textContent));
  } catch (e) {
    console.error(e);
  }
}

reactRender(
  <Provider store={store}>
    <LocalizationContext baseurl={`${PATHS.static}l10n/`}>
      <Fragment>
        <div id="main">
          <Page/>
        </div>
        <Overlay/>
      </Fragment>
    </LocalizationContext>
  </Provider>,
  document.getElementById("app"),
);
