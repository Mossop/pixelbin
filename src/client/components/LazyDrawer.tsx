import type { DrawerProps } from "@material-ui/core/Drawer";
import { useRef, lazy, Suspense } from "react";

import type { ReactResult } from "../utils/types";

const Drawer = lazy(() => import(/* webpackChunkName: "Drawer" */ "@material-ui/core/Drawer"));

export default function LazyDrawer(props: DrawerProps): ReactResult {
  let hasOpened = useRef(props.open);
  if (props.open) {
    hasOpened.current = true;
  }

  if (!hasOpened.current) {
    return null;
  }

  return <Suspense fallback={null}>
    <Drawer {...props}/>
  </Suspense>;
}
