import Box from "@material-ui/core/Box";
import { useTheme } from "@material-ui/core/styles";
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
    return <Box display="flex" flexDirection="column" minHeight="100vh" alignItems="stretch">
      <Banner
        onMenuButtonClick={sidebarModal ? onMenuButtonClick : undefined}
        pageOptions={props.pageOptions}
      />
      <Box
        display="flex"
        flexDirection="row"
        flexGrow={1}
        alignContent="stretch"
        justifyContent="start"
      >
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

  return <Box display="flex" flexDirection="column" minHeight="100vh" alignItems="stretch">
    <Banner pageOptions={props.pageOptions}/>
    <Box
      display="flex"
      flexDirection="row"
      flexGrow={1}
      alignContent="stretch"
      justifyContent="start"
    >
      {props.children}
    </Box>
  </Box>;
}
