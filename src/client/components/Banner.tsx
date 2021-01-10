import { useLocalization } from "@fluent/react";
import { useMediaQuery, useTheme } from "@material-ui/core";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import { lazy, Suspense, useCallback } from "react";

import { DialogType } from "../dialogs/types";
import SidebarToggleIcon from "../icons/SidebarToggleIcon";
import { PageType } from "../pages/types";
import { useUserState } from "../store";
import { useActions } from "../store/actions";
import type { ReactChildren, ReactResult } from "../utils/types";
import AppBar from "./AppBar";
import Tooltip from "./LazyTooltip";
import UILink from "./Link";

const UserMenu = lazy(() => import(/* webpackChunkName: "UserMenu" */ "./UserMenu"));
const PageOptionsMenu = lazy(
  () => import(/* webpackChunkName: "PageOptionsMenu" */ "./PageOptionsMenu"),
);

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    bannerButtons: {
      flexGrow: 1,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      fontSize: "1.5rem",
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
  onMenuButtonClick?: (() => void) | null;
  pageOptions?: PageOption[];
};

export default function Banner({
  pageOptions,
  onMenuButtonClick, children,
}: BannerProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();
  let classes = useStyles();
  let user = useUserState();
  let theme = useTheme();
  let narrow = useMediaQuery(theme.breakpoints.down("xs"));

  let showLoginDialog = useCallback((): void => {
    actions.pushUIState({
      dialog: {
        type: DialogType.Login,
      },
    });
  }, [actions]);

  // let showSignupDialog = useCallback((): void => {
  //   userMenuState.close();
  //   actions.pushUIState({
  //     dialog: {
  //       type: DialogType.Signup,
  //     },
  //   });
  // }, [actions, userMenuState]);

  return <AppBar>
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
      <UILink to={{ page: { type: PageType.Root } }}>PixelBin</UILink>
    </Box>
    <Box id="banner-buttons" className={classes.bannerButtons}>
      {children}
      {
        pageOptions && (
          narrow
            ? <Suspense fallback={null}>
              <PageOptionsMenu pageOptions={pageOptions}/>
            </Suspense>
            : pageOptions.map((option: PageOption) => <Tooltip
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
        )
      }
      {
        user
          ? <Suspense fallback={null}>
            <UserMenu user={user}/>
          </Suspense>
          : <>
            <Button
              id="button-login"
              color="inherit"
              onClick={showLoginDialog}
            >
              {l10n.getString("banner-login")}
            </Button>
            {/* narrow &&
              <Button
                id="button-signup"
                color="inherit"
                onClick={showSignupDialog}
              >
                {l10n.getString("banner-signup")}
              </Button> */}
          </>
      }
    </Box>
  </AppBar>;
}
