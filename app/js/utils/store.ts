import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { ActionType,
  SHOW_LOGIN_OVERLAY,
  SHOW_SIGNUP_OVERLAY,
  COMPLETE_LOGIN,
  COMPLETE_SIGNUP,
  CLOSE_OVERLAY } from "./actions";
import { StoreState, OverlayType } from "../types";

function reducer(state: StoreState, action: ActionType): StoreState {
  switch (action.type) {
    case SHOW_LOGIN_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.Login,
        }
      };
    }
    case SHOW_SIGNUP_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.Signup,
        }
      };
    }
    case COMPLETE_LOGIN: {
      return {
        ...state,
        serverState: action.payload,
        overlay: undefined,
      };
    }
    case COMPLETE_SIGNUP: {
      return {
        ...state,
        serverState: action.payload,
        overlay: undefined,
      };
    }
    case CLOSE_OVERLAY: {
      return {
        ...state,
        overlay: undefined,
      };
    }
  }

  return state;
}

export function buildStore(initialState: StoreState): Store<StoreState, ActionType> {
  const middlewares: Middleware[] = [];

  if (process.env.NODE_ENV === "development") {
    middlewares.push(createLogger());
  }

  return createStore(
    reducer,
    initialState,
    applyMiddleware(...middlewares),
  );
}
