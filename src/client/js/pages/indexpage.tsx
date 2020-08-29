import Typography from "@material-ui/core/Typography";
import React from "react";

import Page from "../components/Page";

export default function IndexPage(): React.ReactElement | null {
  return <Page>
    <Typography variant="h1">Index</Typography>
  </Page>;
}
