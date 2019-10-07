import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import history from "./history";

import { ActionType,
  SHOW_LOGIN_OVERLAY,
  SHOW_SIGNUP_OVERLAY,
  COMPLETE_LOGIN,
  COMPLETE_SIGNUP,
  COMPLETE_LOGOUT,
  CLOSE_OVERLAY } from "./actions";
import { StoreState, OverlayType, Overlay } from "../types";

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
      let newOverlay: Overlay | undefined = undefined;

      if (action.payload.user) {
        if (action.payload.user.catalogs.length) {
          history.push(`/catalog/${action.payload.user.catalogs[0].stub}`);
        } else {
          history.push("/user");
          if (!action.payload.user.hadCatalog) {
            newOverlay = {
              type: OverlayType.CreateCatalog,
            };
          }
        }
      }

      return {
        ...state,
        serverState: action.payload,
        overlay: newOverlay,
      };
    }
    case COMPLETE_SIGNUP: {
      history.push("/user");
      return {
        ...state,
        serverState: action.payload,
        overlay: {
          type: OverlayType.CreateCatalog,
        },
      };
    }
    case COMPLETE_LOGOUT: {
      return {
        ...state,
        serverState: action.payload,
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

  //if (process.env.NODE_ENV === "development") {
  middlewares.push(createLogger());
  //}

  return createStore(
    reducer,
    initialState,
    applyMiddleware(...middlewares),
  );
}
