import Box from "@material-ui/core/Box";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import React, { useCallback, useState } from "react";

import { Catalog, useCatalogs } from "../api/highlevel";
import { ReactResult } from "../utils/types";
import { IncludeVirtualCategories, VirtualItem, VirtualTree } from "../utils/virtual";
import Banner from "./Banner";
import Sidebar from "./Sidebar";
import SidebarTree from "./SidebarTree";

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
    },
    content: {
      display: "flex",
      flexDirection: "row",
      flexGrow: 1,
    },
  }));

export interface PageProps {
  bannerButtons?: React.ReactNode;
  children?: React.ReactNode;
}

export default function Page(props: PageProps): ReactResult {
  const catalogs = useCatalogs().map(
    (catalog: Catalog): VirtualItem => catalog.virtual({
      ...VirtualTree.Albums,
      categories: IncludeVirtualCategories.IfNotEmpty,
    }),
  );

  const [open, setOpen] = useState(true);

  const onMenuButtonClick = useCallback((): void => {
    setOpen(!open);
  }, [open]);

  const classes = useStyles();

  return <Box className={classes.root}>
    <Banner onMenuButtonClick={onMenuButtonClick}>{props.bannerButtons}</Banner>
    <div className={classes.content}>
      <Sidebar open={open}>
        <SidebarTree roots={catalogs}/>
      </Sidebar>
      {props.children}
    </div>
  </Box>;
}
