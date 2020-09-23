import Box from "@material-ui/core/Box";
import { useTheme, makeStyles, createStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import React, { useCallback, useState } from "react";

import { Catalog, useCatalogs } from "../api/highlevel";
import { useSelector } from "../store";
import { StoreState, UIState } from "../store/types";
import { ReactResult } from "../utils/types";
import { IncludeVirtualCategories, VirtualItem, VirtualTree } from "../utils/virtual";
import Banner, { PageOption } from "./Banner";
import { ModalSidebar, PersistentSidebar } from "./Sidebar";
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
}

export default function Page(props: PageProps): ReactResult {
  const catalogs = useCatalogs().map(
    (catalog: Catalog): VirtualItem => catalog.virtual({
      ...VirtualTree.Albums,
      categories: IncludeVirtualCategories.IfNeeded,
    }),
  );

  const theme = useTheme();
  const sidebarModal = useMediaQuery(theme.breakpoints.down("xs"));
  const classes = useStyles();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const uiState = useSelector((state: StoreState): UIState => state.ui);

  const [lastUIState, setLastUIState] = useState<UIState | null>(null);

  if (uiState != lastUIState) {
    setSidebarOpen(false);
    setLastUIState(uiState);
  }

  const onMenuButtonClick = useCallback((): void => {
    setSidebarOpen(true);
  }, []);

  const onCloseSidebar = useCallback((): void => {
    setSidebarOpen(false);
  }, []);

  const { loggedIn } = useSelector((state: StoreState) => ({
    loggedIn: state.serverState.user,
  }));

  if (loggedIn) {
    return <Box className={classes.app}>
      <Banner
        onMenuButtonClick={sidebarModal ? onMenuButtonClick : undefined}
        pageOptions={props.pageOptions}
      />
      <Box className={classes.content}>
        {
          sidebarModal
            ? <ModalSidebar open={sidebarOpen} onClose={onCloseSidebar}>
              <SidebarTree roots={catalogs} selectedItem={props.selectedItem}/>
            </ModalSidebar>
            : <PersistentSidebar open={sidebarOpen} onClose={onCloseSidebar}>
              <SidebarTree roots={catalogs} selectedItem={props.selectedItem}/>
            </PersistentSidebar>
        }
        {props.children}
      </Box>
    </Box>;
  }

  return <Box className={classes.app}>
    <Banner pageOptions={props.pageOptions}/>
    <Box className={classes.content}>
      {props.children}
    </Box>
  </Box>;
}
