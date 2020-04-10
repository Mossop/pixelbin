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
import actions from "./store/actions";
import { decode } from "./utils/decoders";
import { addListener, HistoryState } from "./utils/history";
import { intoUIState } from "./utils/navigation";

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

addListener((historyState: HistoryState): void => {
  let uiState = intoUIState(historyState, store.getState().serverState);
  store.dispatch(actions.historyStateChanged(uiState));
});

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
