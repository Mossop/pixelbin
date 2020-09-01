import { Localized } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Link from "@material-ui/core/Link";
import Typography from "@material-ui/core/Typography";
import React from "react";

import AppBar from "../components/AppBar";
import Content from "../components/Content";
import { ReactResult } from "../utils/types";

export interface ErrorPageProps {
  error: string;
}

export default function ErrorPage(props: ErrorPageProps): ReactResult {
  let onRefresh = (event: React.MouseEvent): void => {
    event.preventDefault();

    window.location.reload();
  };

  let onLoadMainPage = (event: React.MouseEvent): void => {
    event.preventDefault();

    window.location.href = "/";
  };

  return <React.Fragment>
    <AppBar>
      <Box
        style={
          {
            fontSize: "1.25rem",
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
      <Localized id="error-title"><Typography variant="h2"/></Localized>
      <Localized id="error-content"><Typography variant="body1"/></Localized>
      <Box m={2} component="pre">{props.error}</Box>
      <Localized
        id="error-suggestion"
        elems={
          {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Reload: <Link href="" onClick={onRefresh}/>,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Main: <Link href="/" onClick={onLoadMainPage}/>,
          }
        }
      >
        <Typography variant="body1"/>
      </Localized>
    </Content>
  </React.Fragment>;
}
