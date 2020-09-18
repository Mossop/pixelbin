import Box from "@material-ui/core/Box";
import Dialog from "@material-ui/core/Dialog";
import Drawer from "@material-ui/core/Drawer";
import Hidden from "@material-ui/core/Hidden";
import IconButton from "@material-ui/core/IconButton";
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

export type SidebarProps = ReactChildren & {
  open: boolean;
  onClose: () => void;
};

const Transition = forwardRef(function Transition(
  props: TransitionProps & { children?: React.ReactElement<unknown, unknown> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="right" ref={ref} {...props}/>;
});

export default function Sidebar(props: SidebarProps): ReactResult {
  const classes = useStyles();

  return <React.Fragment>
    <Hidden xsDown={true}>
      <Drawer
        variant="persistent"
        open={true}
        PaperProps={
          {
            className: classes.paper,
          }
        }
      >
        {props.children}
      </Drawer>
    </Hidden>
    <Hidden smUp={true}>
      <Dialog open={props.open} fullScreen={true} TransitionComponent={Transition}>
        <Box className={classes.closeButton}>
          <IconButton aria-label="close" onClick={props.onClose}>
            <CloseIcon/>
          </IconButton>
        </Box>
        <Box className={classes.sidebarContent}>
          {props.children}
        </Box>
      </Dialog>
    </Hidden>
  </React.Fragment>;
}
