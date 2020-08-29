import Container from "@material-ui/core/Container";
import React from "react";

import Overlay from "../overlays";
import Page from "../pages";

export default function App(): React.ReactElement | null {
  return <Container disableGutters={true} maxWidth={false}>
    <Page/>
    <Overlay/>
  </Container>;
}
