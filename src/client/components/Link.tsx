import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import type { Draft } from "immer";
import { useCallback } from "react";

import { useActions } from "../store/actions";
import type { UIState } from "../store/types";
import { buildURL } from "../utils/history";
import { fromUIState } from "../utils/navigation";
import type { ReactChildren, ReactResult } from "../utils/types";

const useStyles = makeStyles(() =>
  createStyles({
    link: {
      textDecoration: "none",
      color: "inherit",
      cursor: "pointer",
    },
  }));

export type LinkProps = ReactChildren & {
  to: Draft<UIState>;
  className?: string;
};

export default function UILink({
  to,
  className,
  children,
}: LinkProps): ReactResult {
  let classes = useStyles();
  let actions = useActions();

  let onClick = useCallback((event: React.MouseEvent): void => {
    if (event.button == 0) {
      actions.pushUIState(to);
      event.preventDefault();
    }
  }, [actions, to]);

  let url = buildURL(fromUIState(to));
  return <a
    href={url}
    onClick={onClick}
    className={clsx(classes.link, className)}
  >
    {children}
  </a>;
}
