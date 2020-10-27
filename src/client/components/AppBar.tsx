import type { AppBarProps } from "@material-ui/core/AppBar";
import MuiAppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import React from "react";

import type { ReactResult } from "../utils/types";

export default function AppBar(props: AppBarProps): ReactResult {
  let { children, ...forwarded } = props;

  return <MuiAppBar id="appbar" position="sticky" elevation={0} {...forwarded}>
    <Toolbar>
      {children}
    </Toolbar>
  </MuiAppBar>;
}
