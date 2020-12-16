import type { BoxProps } from "@material-ui/core/Box";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import clsx from "clsx";

export default function Loading(props: BoxProps): React.ReactElement {
  let { className: classes, ...boxProps } = props;

  return <Box
    className={clsx("loading", classes)}
    display="flex"
    alignItems="center"
    justifyContent="center"
    {...boxProps}
  >
    <CircularProgress/>
  </Box>;
}
