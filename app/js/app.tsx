import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { Switch, Route, Router } from "react-router-dom";
import { JsonDecoder } from "ts.data.json";

import LocalizationContext from "./l10n";
import Overlay from "./overlays/index";
import AlbumPage from "./pages/album";
import CatalogPage from "./pages/catalog";
import IndexPage from "./pages/index";
import NotFound from "./pages/notfound";
import UserPage from "./pages/user";
import store, { history } from "./store";
import { decode } from "./utils/decoders";

export interface Paths {
  static: string;
}

export const PathsDecoder = JsonDecoder.object<Paths>(
  {
    static: JsonDecoder.string,
  },
  "Paths"
);

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
      <Router history={history}>
        <div id="main">
          <Switch>
            <Route path="/user" component={UserPage}/>
            <Route path="/catalog/:id" component={CatalogPage}/>
            <Route path="/album/:id" component={AlbumPage}/>
            <Route exact path="/" component={IndexPage}/>
            <Route component={NotFound}/>
          </Switch>
        </div>
        <Overlay/>
      </Router>
    </LocalizationContext>
  </Provider>,
  document.getElementById("app")
);
