import React, { Fragment } from "react";
import { render as reactRender } from "react-dom";
import { Provider } from "react-redux";
import "core-js/stable";
import "regenerator-runtime/runtime";

import LocalizationContext from "./l10n";
import Overlay from "./overlays";
import { paths, decodeServerState } from "./page";
import Page from "./pages";
import store from "./store";
import actions from "./store/actions";
import { addListener, HistoryState } from "./utils/history";
import { intoUIState, getState } from "./utils/navigation";

let serverState = decodeServerState();
store.dispatch(actions.updateServerState(serverState));
let uiState = getState(serverState);
store.dispatch(actions.updateUIState(uiState));

addListener((historyState: HistoryState): void => {
  let uiState = intoUIState(historyState, store.getState().serverState);
  store.dispatch(actions.updateUIState(uiState));
});

reactRender(
  <Provider store={store}>
    <LocalizationContext baseurl={`${paths.static}l10n/`}>
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
