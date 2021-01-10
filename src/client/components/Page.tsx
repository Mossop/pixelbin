import { useTheme, makeStyles, createStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { Fragment, useCallback, useMemo, useState } from "react";

import type { Reference } from "../api/highlevel";
import { useSelector, useUserState } from "../store";
import type { StoreState, UIState } from "../store/types";
import type { ReactResult } from "../utils/types";
import type { PageOption } from "./Banner";
import Banner from "./Banner";
import Sidebar from "./LazySidebar";
import type { SidebarProps } from "./Sidebar";
import Title from "./Title";

const useStyles = makeStyles(() =>
  createStyles({
    pageContent: {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "start",
    },
    contentRow: {
      flex: 1,
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "start",
      position: "relative",
      overflow: "hidden",
    },
    content: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "start",
      alignItems: "stretch",
    },
    overlay: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
  }));

export interface PageProps {
  children?: React.ReactNode;
  overlay?: React.ReactNode;
  selectedItem?: Reference<unknown>;
  pageOptions?: PageOption[];
  title: string;
}

function uiStateSelector(state: StoreState): UIState {
  return state.ui;
}

export default function Page({
  pageOptions,
  title,
  overlay,
  selectedItem,
  children,
}: PageProps): ReactResult {
  let hasOverlay = !!overlay;

  let theme = useTheme();

  let sidebarModal = useMediaQuery(theme.breakpoints.down("xs"));
  let [sidebarOpen, setSidebarOpen] = useState(false);

  let classes = useStyles();

  let uiState = useSelector(uiStateSelector);
  let loggedIn = !!useUserState();

  let [lastUIState, setLastUIState] = useState<UIState | null>(null);

  if (uiState != lastUIState) {
    setSidebarOpen(false);
    setLastUIState(uiState);
  }

  let onCloseSidebar = useCallback((): void => {
    setSidebarOpen(false);
  }, []);

  let sidebarType = useMemo((): SidebarProps["type"] | null => {
    if (!loggedIn) {
      return null;
    }

    if (sidebarModal) {
      return "modal";
    }

    return "persistent";
  }, [sidebarModal, loggedIn]);

  let onMenuButtonClick = useMemo(() => {
    if (!sidebarType || sidebarType == "persistent" && !hasOverlay) {
      return null;
    }
    return () => setSidebarOpen(true);
  }, [sidebarType, hasOverlay]);

  return <div className={classes.pageContent}>
    <Title source="page" title={title}/>
    <Banner
      onMenuButtonClick={onMenuButtonClick}
      pageOptions={pageOptions}
    />
    <div className={classes.contentRow}>
      {
        hasOverlay && sidebarType == "persistent" &&
        <Sidebar
          key="overlaySidebar"
          type="openable"
          selectedItem={selectedItem}
          open={sidebarOpen}
          onClose={onCloseSidebar}
        />
      }
      {
        sidebarType &&
        <Sidebar
          key="sidebar"
          type={sidebarType}
          selectedItem={selectedItem}
          open={sidebarType == "persistent" || sidebarOpen}
          onClose={onCloseSidebar}
        />
      }
      <Fragment key="content">
        {children}
      </Fragment>
      {
        overlay &&
        <div className={classes.overlay}>
          {overlay}
        </div>
      }
    </div>
  </div>;
}
