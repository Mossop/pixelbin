import Typography from "@material-ui/core/Typography";
import React from "react";

import { UserState } from "../api/types";
import Page from "../components/Page";

export interface UserPageProps {
  user: UserState;
}

export default function AlbumPage(_: UserPageProps): React.ReactElement | null {
  return <Page>
    <Typography variant="h1">User</Typography>
  </Page>;
}
