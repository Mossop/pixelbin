import MuiAppBar from "@material-ui/core/AppBar";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import React from "react";

import type { ReactChildren, ReactResult } from "../utils/types";

export const APPBAR_HEIGHT = "9ex";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    banner: {
      height: APPBAR_HEIGHT,
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
  }));

export default function AppBar({ children }: ReactChildren): ReactResult {
  let classes = useStyles();

  return <MuiAppBar
    id="appbar"
    className={classes.banner}
    position="sticky"
    elevation={0}
    role="banner"
  >
    {children}
  </MuiAppBar>;
}
