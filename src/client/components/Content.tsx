import type { BoxProps } from "@material-ui/core/Box";
import Box from "@material-ui/core/Box";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import React from "react";

import type { ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    content: {
      flexGrow: 1,
      padding: theme.spacing(1),
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
    },
  }));

export default function Content(props: BoxProps): ReactResult {
  let classes = useStyles();

  return <Box
    className={classes.content}
    {...props}
  >
    {props.children}
  </Box>;
}
