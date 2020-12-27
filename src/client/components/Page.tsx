import { useTheme, makeStyles, createStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import type { Reference } from "../api/highlevel";
import { useSelector } from "../store";
import type { StoreState, UIState } from "../store/types";
import type { ReactResult } from "../utils/types";
import type { PageOption } from "./Banner";
import Banner from "./Banner";
import type { SidebarProps } from "./Sidebar";
import Sidebar from "./Sidebar";
import SidebarTree from "./SidebarTree";

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

export default function Page({
  selectedItem,
  pageOptions,
  title,
  overlay,
  children,
}: PageProps): ReactResult {
  let hasOverlay = !!overlay;

  let theme = useTheme();

  let sidebarModal = useMediaQuery(theme.breakpoints.down("xs"));
  let [sidebarOpen, setSidebarOpen] = useState(false);

  let classes = useStyles();

  let { uiState, loggedIn } = useSelector((state: StoreState) => ({
    uiState: state.ui,
    loggedIn: state.serverState.user,
  }));

  let [lastUIState, setLastUIState] = useState<UIState | null>(null);

  if (uiState != lastUIState) {
    setSidebarOpen(false);
    setLastUIState(uiState);
  }

  let onCloseSidebar = useCallback((): void => {
    setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!uiState.dialog && !hasOverlay) {
      document.title = title;
    }
  }, [hasOverlay, title, uiState]);

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
    <Banner
      onMenuButtonClick={onMenuButtonClick}
      pageOptions={pageOptions}
    />
    <div className={classes.contentRow}>
      {
        hasOverlay && sidebarType == "persistent" &&
        <Sidebar key="overlaySidebar" type="openable" open={sidebarOpen} onClose={onCloseSidebar}>
          <SidebarTree selectedItem={selectedItem}/>
        </Sidebar>
      }
      {
        sidebarType &&
        <Sidebar key="sidebar" type={sidebarType} open={sidebarOpen} onClose={onCloseSidebar}>
          <SidebarTree selectedItem={selectedItem}/>
        </Sidebar>
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
