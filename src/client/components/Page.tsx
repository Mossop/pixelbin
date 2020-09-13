import Box from "@material-ui/core/Box";
import React, { useCallback, useState } from "react";

import { Catalog, useCatalogs } from "../api/highlevel";
import { useSelector } from "../store";
import { StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import { IncludeVirtualCategories, VirtualItem, VirtualTree } from "../utils/virtual";
import Banner from "./Banner";
import Sidebar from "./Sidebar";
import SidebarTree from "./SidebarTree";

export interface PageProps {
  bannerButtons?: React.ReactNode;
  children?: React.ReactNode;
  selectedItem?: string;
}

export default function Page(props: PageProps): ReactResult {
  const catalogs = useCatalogs().map(
    (catalog: Catalog): VirtualItem => catalog.virtual({
      ...VirtualTree.Albums,
      categories: IncludeVirtualCategories.IfNeeded,
    }),
  );

  const [open, setOpen] = useState(true);

  const onMenuButtonClick = useCallback((): void => {
    setOpen(!open);
  }, [open]);

  const { loggedIn } = useSelector((state: StoreState) => ({
    loggedIn: state.serverState.user,
  }));

  if (loggedIn) {
    return <Box display="flex" flexDirection="column" minHeight="100vh" alignItems="stretch">
      <Banner onMenuButtonClick={onMenuButtonClick}>{props.bannerButtons}</Banner>
      <Box
        display="flex"
        flexDirection="row"
        flexGrow={1}
        alignContent="stretch"
        justifyContent="start"
      >
        <Sidebar open={open}>
          <SidebarTree roots={catalogs} selectedItem={props.selectedItem}/>
        </Sidebar>
        {props.children}
      </Box>
    </Box>;
  }

  return <Box display="flex" flexDirection="column" minHeight="100vh" alignItems="stretch">
    <Banner>{props.bannerButtons}</Banner>
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
