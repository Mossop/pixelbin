import React, { useState } from "react";

import { useElementSize } from "../utils/hooks";
import type { ReactChildren, ReactResult } from "../utils/types";

export type FixedAspectProps = {
  aspectRatio: number;
} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export default function FixedAspect({
  aspectRatio,
  children,
  style = {},
  ...boxProps
}: FixedAspectProps & ReactChildren): ReactResult {
  let [element, setElement] = useState<HTMLDivElement | null>(null);
  let elementSize = useElementSize(element);

  if (!elementSize) {
    return <div
      {...boxProps}
      style={
        {
          position: "relative",
          ...style,
        }
      }
      ref={setElement}
    />;
  }

  let elementRatio = elementSize.width / elementSize.height;

  let targetWidth = elementSize.width;
  let targetHeight = elementSize.height;

  if (elementRatio > aspectRatio) {
    targetWidth = aspectRatio * elementSize.height;
  } else if (elementRatio < aspectRatio) {
    targetHeight = elementSize.width / aspectRatio;
  }

  let xDiff = (elementSize.width - targetWidth) / 2;
  let yDiff = (elementSize.height - targetHeight) / 2;

  return <div
    {...boxProps}
    style={
      {
        position: "relative",
        ...style,
      }
    }
    ref={setElement}
  >
    <div
      style={
        {
          position: "absolute",
          top: yDiff,
          bottom: yDiff,
          left: xDiff,
          right: xDiff,
        }
      }
    >
      {children}
    </div>
  </div>;
}
