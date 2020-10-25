import MuiLink, { LinkTypeMap } from "@material-ui/core/Link";
import { Draft } from "immer";
import React, { useCallback } from "react";

import { useActions } from "../store/actions";
import type { UIState } from "../store/types";
import { buildURL } from "../utils/history";
import { fromUIState } from "../utils/navigation";
import { ReactChildren, ReactResult } from "../utils/types";

export type LinkProps = ReactChildren & {
  to: Draft<UIState>;
  color?: LinkTypeMap["props"]["color"];
  underline?: LinkTypeMap["props"]["underline"];
};

export default function Link({
  to,
  color,
  underline,
  children,
}: LinkProps): ReactResult {
  let actions = useActions();

  let onClick = useCallback((event: React.MouseEvent): void => {
    actions.navigate(to);
    event.preventDefault();
  }, [actions, to]);

  let url = buildURL(fromUIState(to));
  return <MuiLink
    underline={underline ?? "none"}
    color={color}
    href={url}
    onClick={onClick}
  >
    {children}
  </MuiLink>;
}
