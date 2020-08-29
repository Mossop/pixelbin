import CssBaseline from "@material-ui/core/CssBaseline";
import React from "react";
import { render as reactRender } from "react-dom";
import { Provider } from "react-redux";

import App from "./components/App";
import { appContainer, appURL, Url, initialServerState } from "./context";
import { LocalizationContext } from "./l10n/LocalizationContext";
import store from "./store";
import actions from "./store/actions";
import { watchStore } from "./utils/navigation";

let serverState = initialServerState();
store.dispatch(actions.updateServerState(serverState));
watchStore(store);

reactRender(
  <Provider store={store}>
    <LocalizationContext baseurl={`${appURL(Url.L10n)}`} locales={["en-US"]}>
      <CssBaseline/>
      <App/>
    </LocalizationContext>
  </Provider>,
  appContainer(),
);
