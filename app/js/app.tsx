import React, { PureComponent, ReactNode, Fragment } from "react";

import Overlay from "./overlays";
import Page from "./pages";

export default class App extends PureComponent {
  public render(): ReactNode {
    return <Fragment>
      <div id="main">
        <Page/>
      </div>
      <Overlay/>
    </Fragment>;
  }
}
