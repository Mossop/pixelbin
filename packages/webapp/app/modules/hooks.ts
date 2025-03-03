import { useLocation, useRouteLoaderData } from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiConfig } from "./api";
import { Catalog, HistoryState, State } from "./types";

export interface RootData {
  serverConfig: ApiConfig;
  serverState: State | undefined;
}

export function useHistoryState(): HistoryState | undefined {
  return useLocation().state as unknown as HistoryState | undefined;
}

export function useTimeout(
  timeout: number,
  onFire: () => void,
  initialTrigger = false,
): [trigger: (timeout?: number) => void, cancel: () => void] {
  let [target, setTarget] = useState(() =>
    initialTrigger ? Date.now() + timeout : null,
  );
  let timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (target) {
      if (Date.now() >= target) {
        setTarget(null);
        onFire();
      } else {
        timerRef.current = setTimeout(() => {
          timerRef.current = undefined;
          setTarget(null);
          onFire();
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

  let trigger = useCallback(
    (customTimeout?: number) => {
      setTarget((currentTarget) =>
        Math.max(currentTarget ?? 0, Date.now() + (customTimeout ?? timeout)),
      );
    },
    [timeout],
  );

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

export interface TransitionOptions {
  skipInitialTransition?: boolean;
  onShown?: () => void;
  onHidden?: () => void;
}

export function useTransition(
  show: boolean,
  { skipInitialTransition = false, onShown, onHidden }: TransitionOptions = {},
): [elementRef: (element: HTMLElement | null) => void, renderElement: boolean] {
  let [transitionElement, setTransitionElement] = useState<HTMLElement | null>(
    null,
  );

  let [state, setState] = useState(() => {
    if (show) {
      return skipInitialTransition ? Visibility.Shown : Visibility.Pending;
    }
    return Visibility.Hidden;
  });

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

  useEffect(() => {
    transitionElement?.addEventListener("transitionend", onTransitionEnd);

    return () =>
      transitionElement?.removeEventListener("transitionend", onTransitionEnd);
  }, [transitionElement, onTransitionEnd]);

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

  useEffect(() => {
    if (transitionElement) {
      transitionElement.classList.add("transition");
    }

    return () => {
      if (transitionElement) {
        transitionElement.classList.remove("transition");
        transitionElement.classList.remove("t-none");
        transitionElement.classList.remove("t-on");
        transitionElement.classList.remove("t-off");
      }
    };
  }, [transitionElement]);

  useEffect(() => {
    if (transitionElement) {
      if (state == Visibility.Hidden) {
        transitionElement.classList.add("t-none");
        transitionElement.classList.remove("t-on");
        transitionElement.classList.remove("t-off");
      } else if (isVisible(state)) {
        transitionElement.classList.remove("t-none");
        transitionElement.classList.add("t-on");
        transitionElement.classList.remove("t-off");
      } else {
        transitionElement.classList.remove("t-none");
        transitionElement.classList.remove("t-on");
        transitionElement.classList.add("t-off");
      }
    }
  }, [transitionElement, state]);

  return [setTransitionElement, state != Visibility.Hidden];
}

interface FullscreenProps {
  fullscreenElement: (element: HTMLElement | null) => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  isFullscreen: boolean;
}

export function useFullscreen(): FullscreenProps {
  let [element, setElement] = useState<HTMLElement | null>(null);
  let [isFullscreen, setIsFullscreen] = useState(false);

  let onFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  let enterFullscreen = useCallback(() => {
    element?.requestFullscreen().catch(console.error);
  }, [element]);
  let exitFullscreen = useCallback(() => {
    document.exitFullscreen().catch(console.error);
  }, []);

  useEffect(() => {
    setIsFullscreen(!!document.fullscreenElement);
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

function useRootLoaderData(): RootData {
  return useRouteLoaderData("root")!;
}

export function useServerState(): State | undefined {
  return useRootLoaderData().serverState;
}

export function useCatalog(id: string): Catalog | undefined {
  return useServerState()?.catalogs?.find((c) => c.id == id);
}

export function useServerConfig(): ApiConfig {
  return useRootLoaderData().serverConfig;
}

export abstract class BaseContext extends EventTarget {
  protected changed() {
    this.dispatchEvent(new CustomEvent("change"));
  }
}

export function useContextProperty<C extends BaseContext, R>(
  context: C,
  cb: (context: C, previous: R | undefined) => R,
): R {
  let [property, setProperty] = useState(() => cb(context, undefined));

  let updater = useCallback(
    () => setProperty((previous) => cb(context, previous)),
    [context, cb],
  );

  useEffect(() => {
    context.addEventListener("change", updater);
    updater();

    return () => context.removeEventListener("change", updater);
  }, [context, updater]);

  return property;
}

export function contextHook<C extends BaseContext, R>(
  contextGetter: () => C,
  cb: (context: C, previous: R | undefined) => R,
): () => R {
  return () => useContextProperty(contextGetter(), cb);
}

export function contextPropertyHook<C extends BaseContext, P extends keyof C>(
  contextGetter: () => C,
  prop: P,
): () => C[P] {
  return () =>
    useContextProperty(contextGetter(), (context: C): C[P] => context[prop]);
}

export function useCustomElementDefined(element: string): boolean {
  let [defined, setDefined] = useState<string | null>(null);

  useEffect(() => {
    if (defined !== element) {
      void customElements.whenDefined(element).then(() => setDefined(element));
    }
  }, [element, defined]);

  return defined === element;
}
