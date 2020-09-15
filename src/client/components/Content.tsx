import Box, { BoxProps } from "@material-ui/core/Box";
import React from "react";

import { ReactResult } from "../utils/types";

export default function Content(props: BoxProps): ReactResult {
  return <Box
    m={1}
    component="main"
    flexGrow={1}
    display="flex"
    flexDirection="column"
    alignItems="stretch"
    justifyContent="flexStart"
    {...props}
  >
    {props.children}
  </Box>;
}
