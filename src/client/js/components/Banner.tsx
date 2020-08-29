import { useLocalization } from "@fluent/react";
import AppBar from "@material-ui/core/AppBar";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import MenuIcon from "@material-ui/icons/Menu";
import React, { useCallback } from "react";

import { logout } from "../api/auth";
import { PageType } from "../pages/types";
import { useActions } from "../store/actions";
import { If, Then, Else } from "../utils/Conditions";
import { isLoggedIn } from "../utils/helpers";
import Link from "./Link";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    banner: {
      zIndex: theme.zIndex.drawer + 1,
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
    },
    titleText: {
      fontSize: "20px",
      fontFamily: "\"Comfortaa\", cursive",
      fontWeight: "bold",
    },
  }));

export interface BannerProps {
  onMenuButtonClick?: () => void;
  children?: React.ReactNode;
}

export default function Banner(props: BannerProps): React.ReactElement | null {
  const { l10n } = useLocalization();
  const actions = useActions();
  const classes = useStyles();

  const showLoginOverlay = useCallback((): void => actions.showLoginOverlay(), [actions]);
  const showSignupOverlay = useCallback((): void => actions.showSignupOverlay(), [actions]);

  const doLogout = useCallback(async (): Promise<void> => {
    let state = await logout();
    actions.completeLogout(state);
  }, [actions]);

  return <AppBar id="appbar" position="sticky" elevation={0} className={classes.banner}>
    <Toolbar>
      {
        props.onMenuButtonClick && <IconButton
          onClick={props.onMenuButtonClick}
          edge="start"
          className={classes.menuButton}
          color="inherit"
          aria-label="menu"
        >
          <MenuIcon/>
        </IconButton>
      }
      <Box className={classes.title}>
        <Typography className={classes.titleText} variant="h6">
          <Link to={{ page: { type: PageType.Index } }} color="inherit">PixelBin</Link>
        </Typography>
      </Box>
      <Box id="banner-buttons">
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
      </Box>
    </Toolbar>
  </AppBar>;
}
