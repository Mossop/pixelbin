import type { TooltipProps } from "@material-ui/core/Tooltip";
import { lazy, Suspense, useCallback, useState } from "react";

import type { ReactResult } from "../utils/types";

const Tooltip = lazy(() => import(/* webpackChunkName: "Tooltip" */ "@material-ui/core/Tooltip"));

export default function LazyTooltip({ children, ...props }: TooltipProps): ReactResult {
  let [loaded, setLoaded] = useState(false);

  let load = useCallback(() => setLoaded(true), []);

  if (!loaded) {
    return <div onMouseOver={load}>{children}</div>;
  }

  return <Suspense fallback={<div>{children}</div>}>
    <Tooltip {...props}>{children}</Tooltip>
  </Suspense>;
}
