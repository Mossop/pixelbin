import { applyMiddleware, createStore, Store, Action, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { ActionType, BaseAction } from "./actions";
import { StoreState, StateDecoder, decode } from "../types";

function isBaseAction(action: Action): action is BaseAction {
  return action.type === ActionType.Callable;
}

function reducer (state: StoreState, action: Action): StoreState {
  if (isBaseAction(action)) {
    return action.apply(state);
  }
  return state;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildStore(initialState: any): Store {
  const middlewares: Middleware[] = [];

  if (process.env.NODE_ENV === "development") {
    middlewares.push(createLogger());
  }

  return createStore(
    reducer,
    { state: decode(StateDecoder, initialState) },
    applyMiddleware(...middlewares),
  );
}
