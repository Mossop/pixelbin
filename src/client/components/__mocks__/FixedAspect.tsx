import type { ReactChildren, ReactResult } from "../../utils/types";

export default function FixedAspect({ children }: ReactChildren): ReactResult {
  return <div className="fixed-aspect">
    {children}
  </div>;
}
