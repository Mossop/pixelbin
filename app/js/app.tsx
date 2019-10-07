import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { Router, Route } from "react-router-dom";

import { buildStore } from "./utils/store";
import { StoreState, ServerStateDecoder, decode } from "./types";
import history from "./utils/history";

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
    <Router history={history}>
      <Banner/>
      <div id="main">
        <Route path="/">
          <IndexPage/>
        </Route>
        <Overlay/>
      </div>
    </Router>
  </Provider>,
  document.getElementById("app")
);
