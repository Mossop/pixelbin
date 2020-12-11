import Fade from "@material-ui/core/Fade";
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import Delayed from "../utils/delayed";
import type { ReactRef, ReactResult } from "../utils/types";

const HoverContext = createContext(false);

export function useHoverContext(): boolean {
  return useContext(HoverContext);
}

export type HoverContainerProps = {
  initial?: boolean;
  timeout?: number;
} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export const HoverContainer = forwardRef(
  function HoverContainer(props: HoverContainerProps, ref: ReactRef | null): ReactResult {
    let {
      onMouseOver,
      onMouseMove,
      initial = false,
      timeout = 1500,
      children,
      ...rest
    } = props;

    let [hovered, setHovered] = useState(initial);

    let delayed = useMemo(() => {
      let delayed = new Delayed(timeout, () => setHovered(false));
      if (initial) {
        delayed.trigger();
      }
      return delayed;
    }, [initial, timeout]);

    useEffect(() => () => delayed.cancel());

    let markHovered = useCallback(() => {
      setHovered(true);
      delayed.trigger();
    }, [delayed]);

    let mouseOver = useCallback((event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
      if (onMouseOver) {
        onMouseOver(event);
      }
      markHovered();
    }, [markHovered, onMouseOver]);

    let mouseMove = useCallback((event: React.MouseEvent<HTMLDivElement, MouseEvent>): void => {
      if (onMouseMove) {
        onMouseMove(event);
      }
      markHovered();
    }, [markHovered, onMouseMove]);

    return <div
      onMouseOver={mouseOver}
      onMouseMove={mouseMove}
      ref={ref}
      {...rest}
    >
      <HoverContext.Provider value={hovered}>
        {children}
      </HoverContext.Provider>
    </div>;
  },
);

export interface HoverAreaProps {
  timeout?: number;
  children?: React.ReactElement;
}

export function HoverArea(props: HoverAreaProps): ReactResult {
  let hovered = useHoverContext();

  let {
    timeout = 500,
    children,
  } = props;

  return <Fade in={hovered} timeout={timeout}>
    {children}
  </Fade>;
}
