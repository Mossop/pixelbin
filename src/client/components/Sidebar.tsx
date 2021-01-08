import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Slide from "@material-ui/core/Slide";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import type { TransitionProps } from "@material-ui/core/transitions";
import { forwardRef } from "react";

import type { Reference } from "../api/highlevel";
import CloseIcon from "../icons/CloseIcon";
import type { ReactChildren, ReactResult } from "../utils/types";
import Dialog from "./LazyDialog";
import Drawer from "./LazyDrawer";
import SidebarTree from "./SidebarTree";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    paper: {
      overflow: "auto",
    },
    closeButton: {
      position: "sticky",
      alignSelf: "end",
      top: 0,
      padding: theme.spacing(1),
    },
  }));

export type OpenableSidebarProps = ReactChildren & {
  open: boolean;
  onClose: () => void;
};

export type SidebarProps = OpenableSidebarProps & {
  type: "openable" | "persistent" | "modal";
  selectedItem?: Reference<unknown>;
};

const Transition = forwardRef(function Transition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: TransitionProps & { children?: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="right" ref={ref} {...props}/>;
});

function PersistentSidebar({ children }: ReactChildren): ReactResult {
  let classes = useStyles();

  return <Paper
    id="sidebar-persistent"
    square={true}
    component="nav"
    variant="outlined"
    className={classes.paper}
  >
    {children}
  </Paper>;
}

function ModalSidebar({
  open,
  onClose,
  children,
}: OpenableSidebarProps): ReactResult {
  let classes = useStyles();

  return <Dialog
    id="sidebar-modal"
    open={open}
    fullScreen={true}
    TransitionComponent={Transition}
  >
    <IconButton
      aria-label="close"
      id="sidebar-close"
      className={classes.closeButton}
      onClick={onClose}
    >
      <CloseIcon/>
    </IconButton>
    <Box>
      {children}
    </Box>
  </Dialog>;
}

function PopoutSidebar({
  open,
  onClose,
  children,
}: OpenableSidebarProps): ReactResult {
  return <Drawer open={open} onClose={onClose} anchor="left">
    {children}
  </Drawer>;
}

export default function Sidebar({ selectedItem, ...props }: SidebarProps): ReactResult {
  switch (props.type) {
    case "modal":
      return <ModalSidebar {...props}>
        <SidebarTree selectedItem={selectedItem}/>
      </ModalSidebar>;
    case "persistent":
      return <PersistentSidebar {...props}>
        <SidebarTree selectedItem={selectedItem}/>
      </PersistentSidebar>;
    case "openable":
      return <PopoutSidebar {...props}>
        <SidebarTree selectedItem={selectedItem}/>
      </PopoutSidebar>;
  }
}
