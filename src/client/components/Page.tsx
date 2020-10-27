import Box from "@material-ui/core/Box";
import { useTheme, makeStyles, createStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import React, { useCallback, useState } from "react";

import type { Catalog } from "../api/highlevel";
import { useCatalogs } from "../api/highlevel";
import { useSelector } from "../store";
import type { StoreState, UIState } from "../store/types";
import type { ReactResult } from "../utils/types";
import type { VirtualItem } from "../utils/virtual";
import { IncludeVirtualCategories, VirtualTree } from "../utils/virtual";
import type { PageOption } from "./Banner";
import Banner from "./Banner";
import type { SidebarProps } from "./Sidebar";
import Sidebar from "./Sidebar";
import SidebarTree from "./SidebarTree";

const useStyles = makeStyles(() =>
  createStyles({
    app: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
      height: "100vh",
      width: "100vw",
    },
    content: {
      display: "flex",
      flexDirection: "row",
      flexGrow: 1,
      alignItems: "stretch",
      justifyContent: "flex-start",
    },
  }));

export interface PageProps {
  children?: React.ReactNode;
  selectedItem?: string;
  pageOptions?: PageOption[];
  sidebar?: SidebarProps["type"];
}

export default function Page({
  selectedItem,
  pageOptions,
  sidebar,
  children,
}: PageProps): ReactResult {
  let catalogs = useCatalogs().map(
    (catalog: Catalog): VirtualItem => catalog.virtual({
      ...VirtualTree.Albums,
      categories: IncludeVirtualCategories.IfNeeded,
    }),
  );

  let theme = useTheme();
  let classes = useStyles();

  let forceSidebarModal = useMediaQuery(theme.breakpoints.down("xs"));
  let sidebarType = forceSidebarModal ? "modal" : sidebar ?? "persistent";
  let [sidebarOpen, setSidebarOpen] = useState(false);

  let uiState = useSelector((state: StoreState): UIState => state.ui);

  let [lastUIState, setLastUIState] = useState<UIState | null>(null);

  if (uiState != lastUIState) {
    setSidebarOpen(false);
    setLastUIState(uiState);
  }

  let onMenuButtonClick = useCallback((): void => {
    setSidebarOpen(true);
  }, []);

  let onCloseSidebar = useCallback((): void => {
    setSidebarOpen(false);
  }, []);

  let { loggedIn } = useSelector((state: StoreState) => ({
    loggedIn: state.serverState.user,
  }));

  if (loggedIn) {
    return <Box className={classes.app}>
      <Banner
        onMenuButtonClick={sidebarType != "persistent" ? onMenuButtonClick : undefined}
        pageOptions={pageOptions}
      />
      <Box className={classes.content}>
        <Sidebar type={sidebarType} open={sidebarOpen} onClose={onCloseSidebar}>
          <SidebarTree roots={catalogs} selectedItem={selectedItem}/>
        </Sidebar>
        {children}
      </Box>
    </Box>;
  }

  return <Box className={classes.app}>
    <Banner pageOptions={pageOptions}/>
    <Box className={classes.content}>
      {children}
    </Box>
  </Box>;
}
