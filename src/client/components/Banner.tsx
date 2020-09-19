import { useLocalization } from "@fluent/react";
import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Hidden from "@material-ui/core/Hidden";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import MenuIcon from "@material-ui/icons/Menu";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import { usePopupState, bindTrigger, bindPopover } from "material-ui-popup-state/hooks";
import md5 from "md5";
import React, { useCallback } from "react";

import { logout } from "../api/auth";
import { UserState } from "../api/types";
import { PageType } from "../pages/types";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { ReactChildren, ReactResult } from "../utils/types";
import AppBar from "./AppBar";
import Link from "./Link";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    banner: {
      zIndex: theme.zIndex.drawer + 1,
    },
    bannerButtons: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
    },
    titleText: {
      fontSize: "1.25rem",
      fontFamily: "\"Comfortaa\", cursive",
      fontWeight: "bold",
    },
  }));

export interface PageOption {
  id: string;
  label: string;
  onClick: () => void;
}

export type BannerProps = ReactChildren & {
  onMenuButtonClick?: () => void;
  pageOptions?: PageOption[];
};

function avatarSources(user: UserState): string[] {
  let hash = md5(user.email);
  return [
    `https://www.gravatar.com/avatar/${hash}?s=40`,
    `https://www.gravatar.com/avatar/${hash}?s=60 1.5x`,
    `https://www.gravatar.com/avatar/${hash}?s=80 2x`,
  ];
}

export default function Banner(props: BannerProps): ReactResult {
  const { l10n } = useLocalization();
  const actions = useActions();
  const classes = useStyles();
  const user = useSelector((state: StoreState): UserState | null => state.serverState.user);

  const userMenuState = usePopupState({ variant: "popover", popupId: "user-menu" });
  const pageOptionsState = usePopupState({ variant: "popover", popupId: "page-options" });

  const showLoginOverlay = useCallback((): void => {
    userMenuState.close();
    actions.showLoginOverlay();
  }, [actions, userMenuState]);
  const showSignupOverlay = useCallback((): void => {
    userMenuState.close();
    actions.showSignupOverlay();
  }, [actions, userMenuState]);
  const doLogout = useCallback(async (): Promise<void> => {
    userMenuState.close();
    let state = await logout();
    actions.completeLogout(state);
  }, [actions, userMenuState]);

  const pageOptionClick = useCallback((pageOption: PageOption): void => {
    pageOptionsState.close();
    pageOption.onClick();
  }, [pageOptionsState]);

  return <AppBar className={classes.banner} role="banner">
    {
      props.onMenuButtonClick && <IconButton
        id="menu-button"
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
      <Box className={classes.titleText} component="span">
        <Link to={{ page: { type: PageType.Index } }} color="inherit">PixelBin</Link>
      </Box>
    </Box>
    <Box id="banner-buttons" className={classes.bannerButtons}>
      {props.children}
      {
        props.pageOptions && <React.Fragment>
          <Hidden smUp={true}>
            <IconButton {...bindTrigger(pageOptionsState)} color="inherit">
              <MoreVertIcon/>
            </IconButton>
            <Menu
              anchorOrigin={
                {
                  vertical: "bottom",
                  horizontal: "right",
                }
              }
              transformOrigin={
                {
                  vertical: "top",
                  horizontal: "right",
                }
              }
              keepMounted={true}
              {...bindPopover(pageOptionsState)}
            >
              {
                props.pageOptions.map((option: PageOption) => <MenuItem
                  key={option.id}
                  id={`pageoption-menu-${option.id}`}
                  color="inherit"
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => pageOptionClick(option)}
                >
                  {option.label}
                </MenuItem>)
              }
            </Menu>
          </Hidden>
          <Hidden xsDown={true}>
            {
              props.pageOptions.map((option: PageOption) => <Button
                key={option.id}
                id={`pageoption-button-${option.id}`}
                color="inherit"
                onClick={option.onClick}
              >
                {option.label}
              </Button>)
            }
          </Hidden>
        </React.Fragment>
      }
      {
        user
          ? <React.Fragment>
            <IconButton id="banner-user-menu" {...bindTrigger(userMenuState)}>
              <Avatar
                alt={user.fullname}
                srcSet={avatarSources(user).join(", ")}
                src={avatarSources(user)[0]}
              />
            </IconButton>
            <Menu
              {...bindPopover(userMenuState)}
              anchorOrigin={
                {
                  vertical: "bottom",
                  horizontal: "right",
                }
              }
              transformOrigin={
                {
                  vertical: "top",
                  horizontal: "right",
                }
              }
              keepMounted={true}
            >
              <MenuItem id="user-menu-logout" onClick={doLogout}>
                {l10n.getString("banner-logout")}
              </MenuItem>
            </Menu>
          </React.Fragment>
          : <React.Fragment>
            <Button
              id="button-login"
              color="inherit"
              onClick={showLoginOverlay}
            >
              {l10n.getString("banner-login")}
            </Button>
            <Hidden xsDown={true}>
              <Button
                id="button-signup"
                color="inherit"
                onClick={showSignupOverlay}
              >
                {l10n.getString("banner-signup")}
              </Button>
            </Hidden>
          </React.Fragment>
      }
    </Box>
  </AppBar>;
}
