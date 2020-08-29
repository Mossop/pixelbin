import { useLocalization } from "@fluent/react";
import AppBar from "@material-ui/core/AppBar";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import { styled } from "@material-ui/core/styles";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import React, { useCallback } from "react";

import { logout } from "../api/auth";
import { PageType } from "../pages/types";
import { useActions } from "../store/actions";
import { If, Then, Else } from "../utils/Conditions";
import { isLoggedIn } from "../utils/helpers";
import Link from "./Link";

const LogoText = styled(Typography)({
  fontSize: "20px",
  fontFamily: "\"Comfortaa\", cursive",
  fontWeight: "bold",
});

export default function Banner(props: { children?: React.ReactNode }): React.ReactElement | null {
  const { l10n } = useLocalization();
  const actions = useActions();

  const showLoginOverlay = useCallback((): void => actions.showLoginOverlay(), [actions]);
  const showSignupOverlay = useCallback((): void => actions.showSignupOverlay(), [actions]);

  const doLogout = useCallback(async (): Promise<void> => {
    let state = await logout();
    actions.completeLogout(state);
  }, [actions]);

  return <AppBar id="appbar" position="sticky">
    <Toolbar>
      <Box style={{ flexGrow: 1 }}>
        <LogoText variant="h6">
          <Link to={{ page: { type: PageType.Index } }} color="inherit">PixelBin</Link>
        </LogoText>
      </Box>
      {props.children}
      <If condition={isLoggedIn}>
        <Then>
          <Button
            id="button-logout"
            color="inherit"
            onClick={doLogout}
          >
            {l10n.getString("banner-logout")}
          </Button>
        </Then>
        <Else>
          <Button
            id="button-login"
            color="inherit"
            onClick={showLoginOverlay}
          >
            {l10n.getString("banner-login")}
          </Button>
          <Button
            id="button-signup"
            color="inherit"
            onClick={showSignupOverlay}
          >
            {l10n.getString("banner-signup")}
          </Button>
        </Else>
      </If>
    </Toolbar>
  </AppBar>;
}
