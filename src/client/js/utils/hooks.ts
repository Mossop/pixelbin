import { useCallback, useState } from "react";

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
