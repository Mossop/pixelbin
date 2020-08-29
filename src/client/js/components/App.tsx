import React from "react";

import Overlay from "../overlays";
import Page from "../pages";

export default function App(): React.ReactElement | null {
  return <React.Fragment>
    <Page/>
    <Overlay/>
  </React.Fragment>;
}
