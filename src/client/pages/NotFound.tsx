import { useLocalization } from "@fluent/react";
import Typography from "@material-ui/core/Typography";

import Content from "../components/Content";
import Page from "../components/Page";
import type { ReactResult } from "../utils/types";

export default function NotFoundPage(): ReactResult {
  let { l10n } = useLocalization();

  return <Page title={l10n.getString("notfound-page-title")}>
    <Content>
      <Typography variant="h1">Not found</Typography>
    </Content>
  </Page>;
}
