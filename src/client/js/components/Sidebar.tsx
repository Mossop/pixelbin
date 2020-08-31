import Drawer from "@material-ui/core/Drawer";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import React from "react";

import { ReactChildren, ReactResult } from "../utils/types";

const useStyles = makeStyles(() =>
  createStyles({
    paper: {
      position: "sticky",
    },
  }));

export type SidebarProps = ReactChildren & {
  open: boolean;
};

export default function Sidebar(props: SidebarProps): ReactResult {
  const classes = useStyles();

  return <Drawer
    variant="persistent"
    open={true}
    PaperProps={
      {
        className: classes.paper,
      }
    }
  >
    {props.children}
  </Drawer>;
}
