import { useTheme, makeStyles, createStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useSelector } from "../store";
import type { StoreState, UIState } from "../store/types";
import { useElementWidth } from "../utils/hooks";
import type { ReactResult } from "../utils/types";
import { APPBAR_HEIGHT } from "./AppBar";
import type { PageOption } from "./Banner";
import Banner from "./Banner";
import type { SidebarProps } from "./Sidebar";
import Sidebar from "./Sidebar";
import SidebarTree from "./SidebarTree";

interface StyleProps {
  contentWidth: number | null | undefined;
  hasOverlay: boolean;
}

const useStyles = makeStyles(() =>
  createStyles({
    scrollArea: ({ hasOverlay }: StyleProps) => ({
      height: "100%",
      width: "100%",
      overflow: hasOverlay ? "hidden" : "auto",
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      alignItems: "stretch",
      justifyContent: "flex-start",
    }),
    contentRow: {
      flexGrow: 1,
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
    },
    content: ({ contentWidth }: StyleProps) => ({
      flexGrow: contentWidth ? undefined : 1,
      width: contentWidth ?? undefined,
      display: "flex",
      flexDirection: "column",
      justifyContent: "start",
      alignItems: "stretch",
    }),
    overlay: {
      position: "absolute",
      top: APPBAR_HEIGHT,
      bottom: 0,
      left: 0,
      right: 0,
    },
  }));

export interface PageProps {
  children?: React.ReactNode;
  overlay?: React.ReactNode;
  selectedItem?: string;
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

  let [contentElement, setContentElement] = useState<HTMLElement | null>(null);
  let contentWidth = useElementWidth(contentElement);

  let classes = useStyles({
    hasOverlay,
    contentWidth: hasOverlay ? contentWidth : undefined,
  });

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

  return <>
    <div className={classes.scrollArea}>
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
        <div
          key="content"
          ref={sidebarType == "persistent" ? setContentElement : null}
          className={classes.content}
        >
          {children}
        </div>
      </div>
    </div>
    {
      overlay &&
      <div className={classes.overlay}>
        {overlay}
      </div>
    }
  </>;
}
