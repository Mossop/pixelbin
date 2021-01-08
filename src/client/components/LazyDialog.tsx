import type { DialogProps } from "@material-ui/core/Dialog";
import { useRef, lazy, Suspense } from "react";

import type { ReactResult } from "../utils/types";

const Dialog = lazy(() => import(/* webpackChunkName: "Dialog" */ "@material-ui/core/Dialog"));

export default function LazyDialog(props: DialogProps): ReactResult {
  let hasOpened = useRef(props.open);
  if (props.open) {
    hasOpened.current = true;
  }

  if (!hasOpened.current) {
    return null;
  }

  return <Suspense fallback={null}>
    <Dialog {...props}/>
  </Suspense>;
}
