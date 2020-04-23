import React from "react";
import { render as reactRender } from "react-dom";
import { Provider } from "react-redux";
import "core-js/stable";
import "regenerator-runtime/runtime";

import App from "./app";
import document from "./environment/document";
import { LocalizationContext } from "./l10n/LocalizationContext";
import { paths, decodeServerState } from "./page";
import store from "./store";
import actions from "./store/actions";
import { watchStore } from "./utils/navigation";

let serverState = decodeServerState();
store.dispatch(actions.updateServerState(serverState));
watchStore(store);

reactRender(
  <Provider store={store}>
    <LocalizationContext baseurl={`${paths.static}l10n/`}>
      <App/>
    </LocalizationContext>
  </Provider>,
  document.getElementById("app"),
);
