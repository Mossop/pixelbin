import { useLocalization } from "@fluent/react";

import Content from "../components/Content";
import Page from "../components/Page";
import { PageTitle } from "../components/Title";
import type { ReactResult } from "../utils/types";

export default function NotFoundPage(): ReactResult {
  let { l10n } = useLocalization();

  return <Page title={l10n.getString("notfound-page-title")}>
    <Content>
      <PageTitle/>
    </Content>
  </Page>;
}
