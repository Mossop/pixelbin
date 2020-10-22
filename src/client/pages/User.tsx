import Typography from "@material-ui/core/Typography";
import React from "react";

import Content from "../components/Content";
import Page from "../components/Page";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps } from "./types";

export default function UserPage(_props: AuthenticatedPageProps): ReactResult {
  return <Page>
    <Content>
      <Typography variant="h1">User</Typography>
    </Content>
  </Page>;
}
