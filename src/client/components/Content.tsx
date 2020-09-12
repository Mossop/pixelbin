import Box from "@material-ui/core/Box";
import React from "react";

import { ReactChildren, ReactResult } from "../utils/types";

export default function Content(props: ReactChildren): ReactResult {
  return <Box m={1} component="main">{props.children}</Box>;
}
