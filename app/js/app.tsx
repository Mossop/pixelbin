import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { Router, Switch, Route } from "react-router-dom";

import { buildStore } from "./utils/store";
import { StoreState, ServerStateDecoder, Paths, PathsDecoder, decode } from "./types";
import history from "./utils/history";

import IndexPage from "./pages/index";
import UserPage from "./pages/user";
import Overlay from "./overlays/index";
import LocalizationContext from "./l10n";
import { If, Else, Then } from "./utils/Conditions";
import { loggedIn } from "./utils/helpers";

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

let initialState: StoreState = { serverState: { } };
let stateElement = document.getElementById("initial-state");
if (stateElement && stateElement.textContent) {
  try {
    initialState = {
      serverState: decode(ServerStateDecoder, JSON.parse(stateElement.textContent)),
    };
  } catch (e) {
    console.error(e);
  }
}

ReactDOM.render(
  <Provider store={buildStore(initialState)}>
    <LocalizationContext baseurl={`${PATHS.static}l10n/`}>
      <Router history={history}>
        <Switch>
          <Route path="/user">
            <UserPage/>
          </Route>
          <Route exact path="/">
            <IndexPage/>
          </Route>
        </Switch>
        <Overlay/>
      </Router>
    </LocalizationContext>
  </Provider>,
  document.getElementById("app")
);
