import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { BrowserRouter, Route, Switch } from "react-router-dom";

import { buildStore } from "./utils/store";

import Banner from "./content/Banner";
import IndexPage from "./pages/index";
import Overlay from "./overlays/index";

const store = buildStore(JSON.parse(document.getElementById("initial-state").textContent));

ReactDOM.render(
  <Provider store={store}>
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
