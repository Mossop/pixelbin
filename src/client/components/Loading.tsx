import Box, { BoxProps } from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import React from "react";

export default function Loading(props: BoxProps): React.ReactElement {
  let { className: classes, ...boxProps } = props;

  let allClasses = classes ? `${classes} loading` : "loading";

  return <Box
    className={allClasses}
    display="flex"
    alignItems="center"
    justifyContent="center"
    {...boxProps}
  >
    <CircularProgress/>
  </Box>;
}
