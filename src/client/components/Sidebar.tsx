import Box from "@material-ui/core/Box";
import Dialog from "@material-ui/core/Dialog";
import Drawer from "@material-ui/core/Drawer";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Slide from "@material-ui/core/Slide";
import { makeStyles, createStyles, Theme } from "@material-ui/core/styles";
import { TransitionProps } from "@material-ui/core/transitions";
import CloseIcon from "@material-ui/icons/Close";
import React, { forwardRef } from "react";

import { ReactChildren, ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      position: "sticky",
    },
    sidebarContent: {
      paddingTop: theme.spacing(2),
    },
    closeButton: {
      position: "absolute",
      top: 0,
      right: 0,
      zIndex: theme.zIndex.modal + 10,
    },
  }));

export type OpenableSidebarProps = ReactChildren & {
  open: boolean;
  onClose: () => void;
};

export type SidebarProps = OpenableSidebarProps & {
  type: "openable" | "persistent" | "modal";
};

const Transition = forwardRef(function Transition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: TransitionProps & { children?: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="right" ref={ref} {...props}/>;
});

function PersistentSidebar(props: ReactChildren): ReactResult {
  const classes = useStyles();

  return <Paper
    id="sidebar-persistent"
    square={true}
    component="nav"
    variant="outlined"
    className={classes.paper}
  >
    {props.children}
  </Paper>;
}

function ModalSidebar(props: OpenableSidebarProps): ReactResult {
  const classes = useStyles();

  return <Dialog
    id="sidebar-modal"
    open={props.open}
    fullScreen={true}
    TransitionComponent={Transition}
  >
    <Box className={classes.closeButton}>
      <IconButton aria-label="close" id="sidebar-close" onClick={props.onClose}>
        <CloseIcon/>
      </IconButton>
    </Box>
    <Box className={classes.sidebarContent}>
      {props.children}
    </Box>
  </Dialog>;
}

function PopoutSidebar(props: OpenableSidebarProps): ReactResult {
  return <Drawer open={props.open} onClose={props.onClose} anchor="left">
    {props.children}
  </Drawer>;
}

export default function Sidebar(props: SidebarProps): ReactResult {
  switch (props.type) {
    case "modal":
      return <ModalSidebar {...props}/>;
    case "persistent":
      return <PersistentSidebar {...props}/>;
    case "openable":
      return <PopoutSidebar {...props}/>;
  }
}