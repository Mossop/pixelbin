"use client";

import clsx from "clsx";
import { useCallback, useState } from "react";

import { useTimeout, useTransition } from "@/modules/client-util";

const TIMEOUT = 4000;

export default function Overlay({
  children,
  className,
  innerClass,
}: {
  children: React.ReactNode;
  className?: string;
  innerClass?: string;
}) {
  let [shown, setShown] = useState(true);
  let innerProps = useTransition(shown);

  let [triggerTimeout] = useTimeout(
    TIMEOUT,
    useCallback(() => setShown(false), []),
  );

  let onMouseMove = useCallback(() => {
    setShown(true);
    triggerTimeout();
  }, [triggerTimeout]);

  return (
    <div className={clsx(className, "overlay")} onMouseMove={onMouseMove}>
      <div className={clsx("inner", innerClass)} {...innerProps}>
        {children}
      </div>
    </div>
  );
}
