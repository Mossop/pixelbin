import clsx from "clsx";
import {
  DetailedHTMLProps,
  HTMLAttributes,
  useCallback,
  useState,
} from "react";

import { useTimeout, useTransition } from "@/modules/client-util";

const TIMEOUT = 4000;

export default function Overlay({
  className,
  children,
  ...props
}: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
  let [shown, setShown] = useState(true);
  let [overlayRef, renderOverlay] = useTransition(shown, {
    skipInitialTransition: true,
  });

  let [triggerTimeout] = useTimeout(
    TIMEOUT,
    useCallback(() => setShown(false), []),
    true,
  );

  let onMouseMove = useCallback(() => {
    setShown(true);
    triggerTimeout();
  }, [triggerTimeout]);

  return (
    <div className="c-overlay" onMouseMove={onMouseMove}>
      <div
        className={clsx("overlay-inner", className)}
        ref={overlayRef}
        {...props}
      >
        {renderOverlay && children}
      </div>
    </div>
  );
}
