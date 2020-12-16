import { useLocalization } from "@fluent/react";
import Typography from "@material-ui/core/Typography";

import Content from "../components/Content";
import Page from "../components/Page";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";

export default function UserPage(_props: AuthenticatedPageProps): ReactResult {
  let { l10n } = useLocalization();

  return <Page title={l10n.getString("user-page-title")}>
    <Content>
      <Typography variant="h1">User</Typography>
    </Content>
  </Page>;
}
