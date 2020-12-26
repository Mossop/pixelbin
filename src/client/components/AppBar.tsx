import MuiAppBar from "@material-ui/core/AppBar";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";

import type { ReactChildren, ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    banner: {
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
    position="static"
    elevation={0}
    role="banner"
  >
    {children}
  </MuiAppBar>;
}
