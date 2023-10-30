"use client";

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";

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
  let timerFired = useCallback(onFire, [onFire]);
  let timerRef = useRef<NodeJS.Timeout>();

  let cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  let trigger = useCallback(() => {
    cancel();
    timerRef.current = setTimeout(timerFired, timeout);
  }, [cancel, timerFired, timeout]);

  useInitialize(() => {
    if (initialTrigger) {
      trigger();
    }
  });

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
