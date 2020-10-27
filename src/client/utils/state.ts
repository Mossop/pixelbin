import type { Dispatch, SetStateAction } from "react";

import { memoized } from "../../utils";

export interface FieldState<T> {
  readonly value: T;
  readonly set: Dispatch<SetStateAction<T>>;
}

export type ObjectState<T> = FieldState<T> & {
  readonly [K in keyof T]: ObjectState<T[K]>;
};

function makeReducer<T>(val: SetStateAction<T>): (prev: T) => T {
  if (typeof val == "function") {
    // @ts-ignore
    return val;
  }
  return () => val;
}

function actionCallback<T>(cb: Dispatch<(prev: T) => T>): Dispatch<SetStateAction<T>> {
  return (val: SetStateAction<T>): void => {
    cb(makeReducer(val));
  };
}

export function transformed<S, T>(
  state: FieldState<S>,
  into: (val: S) => T,
  from: (val: T) => S,
): FieldState<T> {
  let current = into(state.value);

  return {
    value: current,
    set: actionCallback((action: (prev: T) => T): void => {
      state.set(from(action(current)));
    }),
  };
}

export const nulledString = memoized(
  function nulledString(state: FieldState<string | null>): FieldState<string> {
    return transformed<string | null, string>(
      state,
      (val: string | null): string => val ?? "",
      (val: string): string | null => val ? val : null,
    );
  },
);

export const wrapState = memoized(
  <T>(...args: [T, Dispatch<T>] | [Pick<FieldState<T>, "value" | "set">]): ObjectState<T> => {
    let value: T, setter: Dispatch<T>;
    if (args.length == 1) {
      value = args[0].value;
      setter = args[0].set;
    } else {
      [value, setter] = args;
    }

    let formState: FieldState<T> = {
      value,
      set: actionCallback((action: (prev: T) => T): void => {
        setter(action(value));
      }),
    };

    // @ts-ignore
    return new Proxy<ObjectState<T>>(formState, {
      get(target: ObjectState<T>, property: string): unknown {
        if (!(property in target)) {
          let formState = {
            value: value[property],
            set: actionCallback((action: (prev: T) => T): void => {
              setter({
                ...value,
                [property]: action(value),
              });
            }),
          };

          target[property] = wrapState(formState);
        }

        return target[property];
      },
    });
  },
);
