import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { Switch, Route } from "react-router-dom";
import { JsonDecoder } from "ts.data.json";

import IndexPage from "./pages/index";
import UserPage from "./pages/user";
import Overlay from "./overlays/index";
import LocalizationContext from "./l10n";
import CatalogPage from "./pages/catalog";
import AlbumPage from "./pages/album";
import store from "./store/store";
import { ReduxRouter } from "./utils/history";
import { decode } from "./utils/decoders";
import NotFound from "./pages/notfound";

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
      <ReduxRouter>
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
      </ReduxRouter>
    </LocalizationContext>
  </Provider>,
  document.getElementById("app")
);
