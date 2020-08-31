import Typography from "@material-ui/core/Typography";
import React from "react";

import Content from "../components/Content";
import Page from "../components/Page";
import { ReactResult } from "../utils/types";

export default function NotFoundPage(): ReactResult {
  return <Page>
    <Content>
      <Typography variant="h1">Index</Typography>
    </Content>
  </Page>;
}
