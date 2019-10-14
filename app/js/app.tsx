import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { Switch, Route } from "react-router-dom";

import { Paths, PathsDecoder, decode } from "./types";
import IndexPage from "./pages/index";
import UserPage from "./pages/user";
import Overlay from "./overlays/index";
import LocalizationContext from "./l10n";
import CatalogPage from "./pages/catalog";
import AlbumPage from "./pages/album";
import store from "./utils/store";
import { ReduxRouter } from "./utils/history";

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

ReactDOM.render(
  <Provider store={store}>
    <LocalizationContext baseurl={`${PATHS.static}l10n/`}>
      <ReduxRouter>
        <Switch>
          <Route path="/user" component={UserPage}/>
          <Route path="/catalog/:id" component={CatalogPage}/>
          <Route path="/album/:id" component={AlbumPage}/>
          <Route exact path="/" component={IndexPage}/>
        </Switch>
        <Overlay/>
      </ReduxRouter>
    </LocalizationContext>
  </Provider>,
  document.getElementById("app")
);
