import Drawer from "@material-ui/core/Drawer";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import React from "react";

const useStyles = makeStyles(() =>
  createStyles({
    paper: {
      position: "sticky",
    },
  }));

export interface SidebarProps {
  open: boolean;
  children?: React.ReactNode;
}

export default function Sidebar(props: SidebarProps): React.ReactElement | null {
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
