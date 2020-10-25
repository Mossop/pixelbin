import { actionCreators } from "deeds/immer";
import { useMemo } from "react";
import { useDispatch } from "react-redux";

import type { reducers } from "./reducer";

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
      get: function <K extends keyof Reducers>(
        target: Partial<ActionDispatchers<Reducers>>,
        prop: K,
      ): Action<Reducers, K> {
        // Must cache the property as they are used for equality checks.
        if (!(prop in target)) {
          // @ts-ignore
          target[prop] = (...args: ActionReducerArgs<Reducers[K]>): void => {
            dispatch({
              type: prop,
              payload: args,
            });
          };
        }

        return target[prop] as Action<Reducers, K>;
      },
    });

    return creators as ActionDispatchers<Reducers>;
  }, [dispatch]);
}

export default creators;
