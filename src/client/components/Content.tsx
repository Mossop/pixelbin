import Box, { BoxProps } from "@material-ui/core/Box";
import { makeStyles, createStyles, Theme } from "@material-ui/core/styles";
import React from "react";

import { ReactResult } from "../utils/types";

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
  const classes = useStyles();

  return <Box
    className={classes.content}
    {...props}
  >
    {props.children}
  </Box>;
}
