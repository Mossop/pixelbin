"use client";

import { useCallback, useState } from "react";

import { useTimeout, useTransition } from "@/modules/client-util";

const TIMEOUT = 3000;

function joinClasses(...classes: (string | null | undefined)[]): string {
  return classes.filter((c) => c).join(" ");
}

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
    <div
      className={joinClasses(className, "overlay")}
      onMouseMove={onMouseMove}
    >
      <div className={joinClasses("inner", innerClass)} {...innerProps}>
        {children}
      </div>
    </div>
  );
}
