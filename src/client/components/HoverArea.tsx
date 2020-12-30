import Fade from "@material-ui/core/Fade";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Delayed from "../utils/delayed";
import { useChainedEvent } from "../utils/hooks";
import type { ReactRef, ReactResult } from "../utils/types";

interface HoverProps {
  hovered: boolean;
  alterBlocking: (blocked: boolean) => void;
}

const HoverContext = createContext<HoverProps | null>(null);

export function useHoverContext(): HoverProps {
  return useContext(HoverContext) ?? {
    hovered: false,
    alterBlocking: () => {
    // no-op.
    },
  };
}

export type HoverContainerProps = {
  timeout?: number;
} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export const HoverContainer = forwardRef(function HoverContainer({
  onPointerEnter,
  onPointerMove,
  onPointerUp,
  timeout = 1500,
  children,
  ...rest
}: HoverContainerProps, ref: ReactRef | null): ReactResult {
  let canHover = useMemo(() => window.matchMedia("(any-hover: hover)").matches, []);
  let touched = useRef(!canHover);
  let blockCount = useRef(touched.current ? 1 : 0);
  let [hovered, setHovered] = useState(blockCount.current > 0);

  let alterBlocking = useCallback((blocking: boolean): void => {
    blockCount.current += blocking ? 1 : -1;
    setHovered(blockCount.current > 0);
  }, []);

  let delayRef = useRef(useMemo(() => {
    let delayed = new Delayed(
      () => alterBlocking(true),
      () => alterBlocking(false),
      timeout,
    );

    delayed.trigger();
    return delayed;
  }, [timeout, alterBlocking]));

  let context = useMemo(() => ({
    hovered,
    alterBlocking,
  }), [hovered, alterBlocking]);

  useEffect(() => {
    let delay = delayRef.current;
    delay.resume(timeout);
    return () => delay.pause();
  }, [timeout]);

  let markHovered = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType == "mouse") {
      delayRef.current.trigger();
    }
  }, [delayRef]);

  let pointerEnter = useChainedEvent(
    markHovered,
    onPointerEnter,
  );

  let pointerMove = useChainedEvent(
    markHovered,
    onPointerMove,
  );

  let pointerUp = useChainedEvent(
    useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
      if (event.pointerType != "mouse") {
        touched.current = !touched.current;
        alterBlocking(touched.current);
      }
    }, [alterBlocking]),
    onPointerUp,
  );

  return <div
    onPointerEnter={pointerEnter}
    onPointerMove={pointerMove}
    onPointerUp={pointerUp}
    ref={ref}
    {...rest}
  >
    <HoverContext.Provider value={context}>
      {children}
    </HoverContext.Provider>
  </div>;
});

export type HoverAreaProps = {
  timeout?: number;
} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export function HoverArea({
  timeout = 500,
  onPointerUp,
  onPointerEnter,
  onPointerLeave,
  children,
  ...props
}: HoverAreaProps): ReactResult {
  let {
    hovered,
    alterBlocking,
  } = useHoverContext();

  let blocked = useRef(false);

  let makeBlocking = useCallback((blocking: boolean) => {
    if (blocked.current == blocking) {
      return;
    }

    blocked.current = blocking;
    alterBlocking(blocking);
  }, [alterBlocking]);

  useEffect(() => {
    if (blocked.current) {
      alterBlocking(true);
    }

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (blocked.current) {
        alterBlocking(false);
      }
    };
  }, [alterBlocking]);

  let pointerUp = useChainedEvent(
    useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
      event.stopPropagation();
    }, []),
    onPointerUp,
  );

  let pointerEnter = useChainedEvent(
    useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
      if (event.pointerType == "mouse") {
        makeBlocking(true);
      }
    }, [makeBlocking]),
    onPointerEnter,
  );

  let pointerLeave = useChainedEvent(
    useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
      if (event.pointerType == "mouse") {
        makeBlocking(false);
      }
    }, [makeBlocking]),
    onPointerLeave,
  );

  return <Fade in={hovered} timeout={timeout}>
    <div
      onPointerUp={pointerUp}
      onPointerEnter={pointerEnter}
      onPointerLeave={pointerLeave}
      {...props}
    >
      {children}
    </div>
  </Fade>;
}
