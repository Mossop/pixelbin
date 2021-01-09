import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Link from "@material-ui/core/Link";

import AppBar from "../components/AppBar";
import Content from "../components/Content";
import { Text, SectionHeader } from "../components/Text";
import Title from "../components/Title";
import { errorString } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface ErrorPageProps {
  error: Error;
}

export default function ErrorPage({ error }: ErrorPageProps): ReactResult {
  let { l10n } = useLocalization();

  let onRefresh = (event: React.MouseEvent): void => {
    event.preventDefault();

    window.location.reload();
  };

  let onLoadMainPage = (event: React.MouseEvent): void => {
    event.preventDefault();

    window.location.href = "/";
  };

  return <>
    <Title source="page" title={l10n.getString("error-page-title")}/>
    <AppBar>
      <Box
        style={
          {
            fontSize: "1.5rem",
            fontFamily: "\"Comfortaa\", cursive",
            fontWeight: "bold",
          }
        }
        component="div"
      >
        <Link href="/" color="inherit" onClick={onLoadMainPage}>PixelBin</Link>
      </Box>
    </AppBar>
    <Content>
      <SectionHeader l10nId="error-title"/>
      <Text l10nId="error-content"/>
      <Box m={2} component="pre">{errorString(l10n, error)}</Box>
      <Text
        l10nId="error-suggestion"
        l10nElements={
          {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Reload: <Link href="" onClick={onRefresh}/>,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Main: <Link href="/" onClick={onLoadMainPage}/>,
          }
        }
      />
    </Content>
  </>;
}
