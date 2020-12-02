import { useLocalization } from "@fluent/react";
import Avatar from "@material-ui/core/Avatar";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Hidden from "@material-ui/core/Hidden";
import IconButton from "@material-ui/core/IconButton";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Tooltip from "@material-ui/core/Tooltip";
import { usePopupState, bindTrigger, bindMenu } from "material-ui-popup-state/hooks";
import md5 from "md5";
import React, { useCallback } from "react";

import { logout } from "../api/auth";
import type { UserState } from "../api/types";
import { DialogType } from "../dialogs/types";
import PageMenuIcon from "../icons/PageMenuIcon";
import SidebarToggleIcon from "../icons/SidebarToggleIcon";
import { PageType } from "../pages/types";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import type { StoreState } from "../store/types";
import type { ReactChildren, ReactResult } from "../utils/types";
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
  icon: React.ReactNode;
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

export default function Banner({
  pageOptions,
  onMenuButtonClick, children,
}: BannerProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();
  let classes = useStyles();
  let user = useSelector((state: StoreState): UserState | null => state.serverState.user);

  let userMenuState = usePopupState({ variant: "popover", popupId: "user-menu" });
  let pageOptionsState = usePopupState({ variant: "popover", popupId: "page-options" });

  let showLoginDialog = useCallback((): void => {
    userMenuState.close();
    actions.showDialog({
      type: DialogType.Login,
    });
  }, [actions, userMenuState]);

  // let showSignupDialog = useCallback((): void => {
  //   userMenuState.close();
  //   actions.showDialog({
  //     type: DialogType.Signup,
  //   });
  // }, [actions, userMenuState]);

  let doLogout = useCallback(async (): Promise<void> => {
    userMenuState.close();
    let state = await logout();
    actions.completeLogout(state);
  }, [actions, userMenuState]);

  let pageOptionClick = useCallback((pageOption: PageOption): void => {
    pageOptionsState.close();
    pageOption.onClick();
  }, [pageOptionsState]);

  return <AppBar className={classes.banner} role="banner">
    {
      onMenuButtonClick && <IconButton
        id="menu-button"
        onClick={onMenuButtonClick}
        edge="start"
        className={classes.menuButton}
        color="inherit"
        aria-label="menu"
      >
        <SidebarToggleIcon/>
      </IconButton>
    }
    <Box className={classes.title}>
      <Box className={classes.titleText} component="span">
        <Link to={{ page: { type: PageType.Root } }} color="inherit">PixelBin</Link>
      </Box>
    </Box>
    <Box id="banner-buttons" className={classes.bannerButtons}>
      {children}
      {
        pageOptions && <React.Fragment>
          <Hidden smUp={true}>
            <IconButton {...bindTrigger(pageOptionsState)} color="inherit">
              <PageMenuIcon/>
            </IconButton>
            <Menu
              {...bindMenu(pageOptionsState)}
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
              getContentAnchorEl={null}
            >
              {
                pageOptions.map((option: PageOption) => <MenuItem
                  key={option.id}
                  id={`pageoption-menu-${option.id}`}
                  color="inherit"
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => pageOptionClick(option)}
                >
                  <ListItemIcon>
                    {option.icon}
                  </ListItemIcon>
                  {option.label}
                </MenuItem>)
              }
            </Menu>
          </Hidden>
          <Hidden xsDown={true}>
            {
              pageOptions.map((option: PageOption) => <Tooltip
                key={option.id}
                title={option.label}
              >
                <IconButton
                  id={`pageoption-button-${option.id}`}
                  color="inherit"
                  onClick={option.onClick}
                >
                  {option.icon}
                </IconButton>
              </Tooltip>)
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
              {...bindMenu(userMenuState)}
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
              getContentAnchorEl={null}
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
              onClick={showLoginDialog}
            >
              {l10n.getString("banner-login")}
            </Button>
            {/* <Hidden xsDown={true}>
              <Button
                id="button-signup"
                color="inherit"
                onClick={showSignupDialog}
              >
                {l10n.getString("banner-signup")}
              </Button>
            </Hidden> */}
          </React.Fragment>
      }
    </Box>
  </AppBar>;
}
