import MuiLink, { LinkTypeMap } from "@material-ui/core/Link";
import { Draft } from "immer";
import React, { useCallback } from "react";

import { useActions } from "../store/actions";
import type { UIState } from "../store/types";
import { buildURL } from "../utils/history";
import { fromUIState } from "../utils/navigation";

interface PassedProps {
  to: Draft<UIState>;
  color?: LinkTypeMap["props"]["color"];
  underline?: LinkTypeMap["props"]["underline"];
  children?: React.ReactNode;
}

export default function Link(props: PassedProps): React.ReactElement | null {
  const actions = useActions();

  const onClick = useCallback((event: React.MouseEvent): void => {
    actions.navigate(props.to);
    event.preventDefault();
  }, [actions, props.to]);

  let url = buildURL(fromUIState(props.to));
  return <MuiLink
    underline={props.underline ?? "none"}
    color={props.color}
    href={url}
    onClick={onClick}
  >
    {props.children}
  </MuiLink>;
}
