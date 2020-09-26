import { useCallback, useEffect, useState } from "react";

import { document } from "../environment";

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

export interface Timeout {
  trigger: () => void;
  cancel: () => void;
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
