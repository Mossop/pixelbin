import { actionCreators } from "deeds/immer";
import { useMemo } from "react";
import { useDispatch } from "react-redux";

import { reducers } from "./reducer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionReducerArgs<R> = R extends (state: any, ...args: infer A) => any ? A : never;
type Action<R, K extends keyof R> = (...args: ActionReducerArgs<R[K]>) => void;
type ActionDispatchers<M> = {
  [K in keyof M]: Action<M, K>;
};

type Reducers = typeof reducers;

const creators = actionCreators<Reducers>();

export function useActions(): ActionDispatchers<Reducers> {
  let dispatch = useDispatch();

  return useMemo(() => {
    let creators = new Proxy({}, {
      has: function(
        target: Partial<ActionDispatchers<Reducers>>,
        prop: string | symbol,
      ): boolean {
        return prop in reducers;
      },

      get: function(
        target: Partial<ActionDispatchers<Reducers>>,
        prop: string | symbol,
      ): unknown {
        if (!(prop in reducers)) {
          return undefined;
        }

        // Must cache the property as they are used for equality checks.
        if (!(prop in target)) {
          target[prop] = (...args: unknown[]): void => {
            dispatch({
              type: prop,
              payload: args,
            });
          };
        }

        return target[prop];
      },
    });

    return creators as ActionDispatchers<Reducers>;
  }, [dispatch]);
}

export default creators;
