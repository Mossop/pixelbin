import React from "react";
import ReactDOM from "react-dom";
import { createStore } from "redux";
import { Provider } from "react-redux";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import { fromJS } from "immutable";

import reducer from "./utils/reducer";
import RestrictedRoute from "./utils/restricted";

import Banner from "./content/banner";
import IndexPage from "./pages/index";
import LoginPage from "./pages/login";
import LogoutPage from "./pages/logout";
import UploadPage from "./pages/upload";

const INITIAL_STATE = JSON.parse(document.getElementById("initial-state").textContent);
const store = createStore(reducer, fromJS(INITIAL_STATE));

ReactDOM.render(
  <Provider store={store}>
    <BrowserRouter basename="/">
      <div id="root">
        <Banner/>
        <Switch>
          <Route exact path="/" component={IndexPage}/>
          <Route path="/login" component={LoginPage}/>
          <Route path="/logout" component={LogoutPage}/>
          <RestrictedRoute path="/upload" component={UploadPage}/>
        </Switch>
      </div>
    </BrowserRouter>
  </Provider>,
  document.getElementById("app")
);
