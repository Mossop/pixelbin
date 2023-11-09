"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export function useInitialize(callback: () => void) {
  let initialised = useRef(false);
  if (!initialised.current) {
    callback();
    initialised.current = true;
  }
}

export function useTimeout(
  timeout: number,
  onFire: () => void,
  initialTrigger: boolean = false,
): [trigger: () => void, cancel: () => void] {
  let [target, setTarget] = useState(
    initialTrigger ? Date.now() + timeout : null,
  );
  let timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (target) {
      if (Date.now() >= target) {
        onFire();
        setTarget(null);
      } else {
        timerRef.current = setTimeout(() => {
          timerRef.current = undefined;
          onFire();
          setTarget(null);
        }, target - Date.now());
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [target, onFire]);

  let cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    setTarget(null);
  }, []);

  let trigger = useCallback(() => {
    setTarget(Date.now() + timeout);
  }, [timeout]);

  return [trigger, cancel];
}

export enum Visibility {
  Hidden = "hidden",
  Pending = "pending",
  Showing = "showing",
  Shown = "shown",
  Hiding = "hiding",
}

function isVisible(visibility: Visibility): boolean {
  return visibility == Visibility.Showing || visibility == Visibility.Shown;
}

function styleForVisibility(visibility: Visibility): CSSProperties {
  if (visibility == Visibility.Hidden) {
    return { display: "none", opacity: 0 };
  }

  return { opacity: isVisible(visibility) ? 1 : 0 };
}

export interface TransitionOptions {
  fadeIn?: boolean;
  onShown?: () => void;
  onHidden?: () => void;
}

export interface TransitionProps {
  style: CSSProperties;
  onTransitionEnd: () => void;
}

export function useTransition(
  show: boolean,
  { fadeIn = false, onShown, onHidden }: TransitionOptions = {},
): TransitionProps {
  let [state, setState] = useState(
    show && !fadeIn ? Visibility.Shown : Visibility.Pending,
  );

  let onTransitionEnd = useCallback(() => {
    setState((currentState) => {
      if (currentState == Visibility.Hiding) {
        if (onHidden) {
          onHidden();
        }
        return Visibility.Hidden;
      }
      if (currentState == Visibility.Showing) {
        if (onShown) {
          onShown();
        }
        return Visibility.Shown;
      }
      return currentState;
    });
  }, [onShown, onHidden]);

  let startShowing = useCallback(
    () => setState((s) => (s == Visibility.Pending ? Visibility.Showing : s)),
    [],
  );
  let [triggerShowing, cancelShowing] = useTimeout(100, startShowing);

  useEffect(() => {
    switch (state) {
      case Visibility.Hidden:
        if (show) {
          setState(Visibility.Pending);
        }
        break;
      case Visibility.Pending:
        if (show) {
          triggerShowing();
        } else {
          cancelShowing();
          setState(Visibility.Hidden);
        }
        break;
      case Visibility.Showing:
      case Visibility.Shown:
        if (!show) {
          setState(Visibility.Hiding);
        }
        break;
      case Visibility.Hiding:
        if (show) {
          setState(Visibility.Showing);
        }
        break;
      default:
        cancelShowing();
        setState(show ? Visibility.Shown : Visibility.Hidden);
    }
  }, [state, show, cancelShowing, triggerShowing]);

  return { style: styleForVisibility(state), onTransitionEnd };
}

interface FullscreenProps {
  fullscreenElement: (element: HTMLElement) => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  isFullscreen: boolean;
}

export function useFullscreen(): FullscreenProps {
  let [element, setElement] = useState<HTMLElement | null>(null);
  let [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  let onFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  let enterFullscreen = useCallback(() => {
    element?.requestFullscreen();
  }, [element]);
  let exitFullscreen = useCallback(() => {
    document.exitFullscreen();
  }, []);

  useEffect(() => {
    element?.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      element?.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [element, onFullscreenChange]);

  return useMemo(
    () => ({
      fullscreenElement: setElement,
      enterFullscreen,
      exitFullscreen,
      isFullscreen,
    }),
    [enterFullscreen, exitFullscreen, isFullscreen],
  );
}
