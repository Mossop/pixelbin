import React, { useState, useEffect } from "react";

export default function useMouseMove(
  ref: React.RefObject<Element>,
  timeout: number = 1000,
): boolean {
  let [timer, setTimer] = useState<number | null>(null);

  let registerActivity = (): void => {
    if (!ref.current) {
      return;
    }

    if (timer) {
      ref.current.ownerDocument.defaultView?.clearTimeout(timer);
    }

    setTimer(window.setTimeout((): void => {
      setTimer(null);
    }, timeout));
  };

  useEffect(() => {
    console.log("Mounted");
    if (!ref.current) {
      console.log("No current in effect");
      return;
    }

    let element = ref.current;

    element.addEventListener("mouseover", registerActivity);
    element.addEventListener("mousemove", registerActivity);

    return (): void => {
      if (timer) {
        element.ownerDocument.defaultView?.clearTimeout(timer);
      }

      element.removeEventListener("mouseover", registerActivity);
      element.removeEventListener("mousemove", registerActivity);
    };
  });

  return timer !== null;
}
