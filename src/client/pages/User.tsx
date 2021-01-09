import { useLocalization } from "@fluent/react";

import Content from "../components/Content";
import Page from "../components/Page";
import { PageTitle } from "../components/Title";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";

export default function UserPage(_props: AuthenticatedPageProps): ReactResult {
  let { l10n } = useLocalization();

  return <Page title={l10n.getString("user-page-title")}>
    <Content>
      <PageTitle/>
    </Content>
  </Page>;
}
