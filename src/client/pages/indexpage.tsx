import Typography from "@material-ui/core/Typography";
import React from "react";

import Content from "../components/Content";
import Page from "../components/Page";
import { ReactResult } from "../utils/types";

export default function IndexPage(): ReactResult {
  return <Page>
    <Content>
      <Typography variant="h1">h1 text</Typography>
      <Typography variant="h2">h2 text</Typography>
      <Typography variant="h3">h3 text</Typography>
      <Typography variant="h4">h4 text</Typography>
      <Typography variant="h5">h5 text</Typography>
      <Typography variant="h6">h6 text</Typography>
    </Content>
  </Page>;
}
