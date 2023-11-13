"use client";

import { useCallback, useState } from "react";

import { useTimeout, useTransition } from "@/modules/client-util";

const TIMEOUT = 4000;

export default function Overlay({ children }: { children: React.ReactNode }) {
  let [shown, setShown] = useState(true);
  let [overlayRef, renderOverlay] = useTransition(shown);

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
      {renderOverlay && (
        <div className="overlay-inner" ref={overlayRef}>
          {children}
        </div>
      )}
    </div>
  );
}
