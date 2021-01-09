import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

import type { ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    content: {
      flex: 1,
      padding: theme.spacing(1),
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
    },
  }));

export default function Content({
  className,
  children,
  ...props
}: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>): ReactResult {
  let classes = useStyles();

  return <main
    className={clsx(classes.content, className)}
    {...props}
  >
    {children}
  </main>;
}
