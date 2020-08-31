import Typography from "@material-ui/core/Typography";
import React from "react";

import { UserState } from "../api/types";
import Content from "../components/Content";
import Page from "../components/Page";
import { ReactResult } from "../utils/types";

export interface UserPageProps {
  user: UserState;
}

export default function AlbumPage(_: UserPageProps): ReactResult {
  return <Page>
    <Content>
      <Typography variant="h1">User</Typography>
    </Content>
  </Page>;
}
