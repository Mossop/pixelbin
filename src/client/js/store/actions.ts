import { actionCreators } from "deeds/immer";
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
  const dispatch = useDispatch();

  let creators = new Proxy({}, {
    get: function <K extends keyof Reducers>(_target: unknown, prop: K): Action<Reducers, K> {
      return (...args: ActionReducerArgs<Reducers[K]>): void => {
        dispatch({
          type: prop,
          payload: args,
        });
      };
    },
  });

  return creators as ActionDispatchers<Reducers>;
}

export default creators;
