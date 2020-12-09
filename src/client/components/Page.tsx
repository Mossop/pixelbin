import { useTheme, makeStyles, createStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { Catalog } from "../api/highlevel";
import { useCatalogs } from "../api/highlevel";
import { useSelector } from "../store";
import type { StoreState, UIState } from "../store/types";
import type { ReactResult } from "../utils/types";
import type { VirtualItem } from "../utils/virtual";
import {
  BaseVirtualCatalogItem,
  VirtualAlbum,
  VirtualSearch,
  IncludeVirtualCategories,
} from "../utils/virtual";
import { APPBAR_HEIGHT } from "./AppBar";
import type { PageOption } from "./Banner";
import Banner from "./Banner";
import type { SidebarProps } from "./Sidebar";
import Sidebar from "./Sidebar";
import SidebarTree from "./SidebarTree";

const useStyles = makeStyles(() =>
  createStyles({
    scrollArea: (showOverlay: boolean) => ({
      height: "100%",
      width: "100%",
      overflow: showOverlay ? "hidden" : "auto",
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
    content: {
      flexGrow: 1,
    },
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
  let catalogs = useCatalogs().map(
    (catalog: Catalog): VirtualItem => catalog.virtual({
      filter: (item: VirtualItem): boolean => {
        return item instanceof VirtualAlbum || item instanceof VirtualSearch ||
          item instanceof BaseVirtualCatalogItem;
      },
      categories: IncludeVirtualCategories.IfNeeded,
    }),
  );

  let hasOverlay = !!overlay;

  let theme = useTheme();
  let classes = useStyles(hasOverlay);

  let sidebarModal = useMediaQuery(theme.breakpoints.down("xs"));
  let [sidebarOpen, setSidebarOpen] = useState(false);

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
    if (!uiState.dialog) {
      document.title = title;
    }
  }, [title, uiState]);

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
    if (!sidebarType || sidebarType == "persistent") {
      return null;
    }
    return () => setSidebarOpen(true);
  }, [sidebarType]);

  return <React.Fragment>
    <div className={classes.scrollArea}>
      <Banner
        onMenuButtonClick={onMenuButtonClick}
        pageOptions={pageOptions}
      />
      <div className={classes.contentRow}>
        {
          hasOverlay && sidebarType == "persistent" &&
          <Sidebar type="openable" open={sidebarOpen} onClose={onCloseSidebar}>
            <SidebarTree roots={catalogs} selectedItem={selectedItem}/>
          </Sidebar>
        }
        {
          sidebarType &&
          <Sidebar type={sidebarType} open={sidebarOpen} onClose={onCloseSidebar}>
            <SidebarTree roots={catalogs} selectedItem={selectedItem}/>
          </Sidebar>
        }
        <div className={classes.content}>
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
  </React.Fragment>;
}
