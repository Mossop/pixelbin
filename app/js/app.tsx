import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { BrowserRouter, Route, Switch } from "react-router-dom";

import { buildStore } from "./utils/store";
import { StoreState, ServerStateDecoder, decode } from "./types";

import Banner from "./content/Banner";
import IndexPage from "./pages/index";
import Overlay from "./overlays/index";

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
    <BrowserRouter basename="/">
      <div id="root">
        <Banner/>
        <Switch>
          <Route exact path="/">
            <IndexPage/>
          </Route>
        </Switch>
        <Overlay/>
      </div>
    </BrowserRouter>
  </Provider>,
  document.getElementById("app")
);
