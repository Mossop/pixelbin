import React from "react";
import ReactDOM from "react-dom";
import { createStore } from "redux";
import { Provider } from "react-redux";
import { BrowserRouter, Route, Link } from "react-router-dom";
import { fromJS } from "immutable";

import { If, Then, Else } from "./utils/if";
import reducer from "./utils/reducer";
import { loggedIn } from "./utils/helpers";

import Banner from "./content/banner";
import Index from "./pages/index";

const INITIAL_STATE = JSON.parse(document.getElementById("initial-state").textContent);
const store = createStore(reducer, fromJS(INITIAL_STATE));

ReactDOM.render(
  <Provider store={store}>
    <BrowserRouter basename="/">
      <div id="root">
        <Banner/>
        <Route exact path="/">
          <If condition={loggedIn}>
            <Else>
              <Index/>
            </Else>
          </If>
        </Route>
        <Route path="/login">
          <div id="content" className="centerblock">
          </div>
        </Route>
        <Route path="/signup">
          <div id="content" className="centerblock">
          </div>
        </Route>
      </div>
    </BrowserRouter>
  </Provider>,
  document.getElementById("app")
);
