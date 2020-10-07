import { useCallback, useEffect, useMemo, useState } from "react";

import { window, document } from "../environment";

type FormElementHook<T> = [T, (event: FormElementEvent<T>) => void, (value: T) => void];

interface FormElement<T> {
  value: T;
}

export interface FormElementEvent<T> {
  target: FormElement<T>;
}

export function useFormFieldState<T>(initial: T): FormElementHook<T> {
  let [currentState, stateSetter] = useState(initial);
  let eventHandler = useCallback(
    (event: FormElementEvent<T>): void => stateSetter(event.target.value),
    [stateSetter],
  );
  return [currentState, eventHandler, stateSetter];
}

type FormHook<T> = [T, <K extends keyof T>(key: K, value: T[K]) => void];

export function useFormState<T>(initial: T): FormHook<T> {
  let [currentState, stateSetter] = useState(initial);

  let setter = useCallback(<K extends keyof T>(key: K, value: T[K]): void => {
    stateSetter((previous: T): T => {
      return {
        ...previous,
        [key]: value,
      };
    });
  }, []);

  return [currentState, setter];
}

type Callback<P extends unknown[]> = (...args: P) => void;
export function useTimeout<P extends unknown[]>(callback: Callback<P>, delay: number): Callback<P> {
  const [timeoutId, setTimeoutId] = useState<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      console.log("Unmount");
      window.clearTimeout(timeoutId);
    };
  }, [callback, timeoutId]);

  return useMemo(() => (...args: P): void => {
    setTimeoutId(window.setTimeout((): void => {
      callback(...args);
    }, delay));
  }, [callback, delay]);
}

export function useFullscreen(): boolean {
  let [fullscreen, setFullscreen] = useState(document.fullscreenElement != null);

  useEffect(() => {
    let listener = (): void => {
      setFullscreen(document.fullscreenElement != null);
    };

    document.addEventListener("fullscreenchange", listener);

    return () => {
      document.removeEventListener("fullscreenchange", listener);
    };
  });

  return fullscreen;
}
