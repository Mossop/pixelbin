import MomentUtils from "@date-io/moment";
import CssBaseline from "@material-ui/core/CssBaseline";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";
import React from "react";
import { render as reactRender } from "react-dom";
import { Provider } from "react-redux";

import App from "./components/App";
import { appContainer, appURL, Url, initialServerState } from "./context";
import { LocalizationContext } from "./l10n/LocalizationContext";
import services from "./services";
import { buildStore } from "./store";
import actions from "./store/actions";
import { watchStore } from "./utils/navigation";

async function init(): Promise<void> {
  buildStore();

  let store = await services.store;

  let serverState = initialServerState();
  store.dispatch(actions.updateServerState(serverState));
  watchStore(store);

  reactRender(
    <Provider store={store}>
      <MuiPickersUtilsProvider utils={MomentUtils}>
        <LocalizationContext baseurl={`${appURL(Url.L10n)}`} locales={["en-US"]}>
          <React.Fragment>
            <CssBaseline/>
            <App/>
          </React.Fragment>
        </LocalizationContext>
      </MuiPickersUtilsProvider>
    </Provider>,
    appContainer(),
  );
}

void init();
