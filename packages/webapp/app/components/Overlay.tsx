import clsx from "clsx";
import {
  DetailedHTMLProps,
  HTMLAttributes,
  useCallback,
  useState,
} from "react";

import { useTimeout, useTransition } from "@/modules/hooks";

import "styles/components/Overlay.scss";

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

  let [triggerTimeout, cancel] = useTimeout(
    TIMEOUT,
    useCallback(() => setShown(false), []),
    true,
  );

  let onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType == "mouse") {
        setShown(true);
        triggerTimeout();
      }
    },
    [triggerTimeout],
  );

  let onTouchStart = useCallback(() => {
    setShown(!shown);
    if (!shown) {
      triggerTimeout(TIMEOUT * 2);
    } else {
      cancel();
    }
  }, [shown, triggerTimeout, cancel]);

  return (
    <div
      className="c-overlay"
      onPointerMove={onPointerMove}
      onTouchStart={onTouchStart}
    >
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
