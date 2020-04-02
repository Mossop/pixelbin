import React from "react";
import ReactDOM from "react-dom";
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
  "Paths"
);

let PATHS: Paths = {
  static: "/static/",
};

let pathsElement = document.getElementById("paths");
if (pathsElement && pathsElement.textContent) {
  try {
    PATHS = decode(PathsDecoder, JSON.parse(pathsElement.textContent));
  } catch (e) {
    console.error(e);
  }
}

ReactDOM.render(
  <Provider store={store}>
    <LocalizationContext baseurl={`${PATHS.static}l10n/`}>
      <div id="main">
        <Page/>
      </div>
      <Overlay/>
    </LocalizationContext>
  </Provider>,
  document.getElementById("app")
);
