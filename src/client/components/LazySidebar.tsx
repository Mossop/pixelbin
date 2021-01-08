import { useRef, lazy, Suspense } from "react";

import type { ReactResult } from "../utils/types";
import type { SidebarProps } from "./Sidebar";

const Sidebar = lazy(() => import(/* webpackChunkName: "Sidebar" */ "./Sidebar"));

export default function LazySidebar(props: SidebarProps): ReactResult {
  let hasOpened = useRef(props.open);
  if (props.open) {
    hasOpened.current = true;
  }

  if (!hasOpened.current) {
    return null;
  }

  return <Suspense fallback={null}>
    <Sidebar {...props}/>
  </Suspense>;
}
