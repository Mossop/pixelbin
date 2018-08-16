import React from "react";
import ReactDOM from "react-dom";
import { createStore } from "redux";
import { Provider } from "react-redux";
import { BrowserRouter, Route } from "react-router-dom";
import { fromJS } from "immutable";

import { If, Then, Else } from "./if";
import reducer from "./reducer";

/* global INITIAL_STATE */
const store = createStore(reducer, fromJS(INITIAL_STATE));

const loggedIn = (state) => {
  return state.get("user", null) != null;
};

ReactDOM.render(
  <Provider store={store}>
    <BrowserRouter basename="/">
      <div id="root">
        <div id="banner">
          <p id="logo">PixelBin</p>
          <div id="rightbanner">
            <If condition={loggedIn}>
              <Then>
                <p>Logged in.</p>
              </Then>
              <Else>
                <p>Not logged in.</p>
              </Else>
            </If>
          </div>
        </div>
        <div id="main">
          <div id="sidebar">
          </div>
          <div id="content">
          </div>
        </div>
      </div>
    </BrowserRouter>
  </Provider>,
  document.getElementById("app")
);
