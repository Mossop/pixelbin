import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import history from "./history";

import { ActionType,
  SHOW_LOGIN_OVERLAY,
  SHOW_SIGNUP_OVERLAY,
  SHOW_CATALOG_CREATE_OVERLAY,
  COMPLETE_LOGIN,
  COMPLETE_SIGNUP,
  COMPLETE_LOGOUT,
  CLOSE_OVERLAY, 
  CATALOG_CREATED} from "./actions";
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
    case SHOW_CATALOG_CREATE_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.CreateCatalog,
        }
      };
    }
    case COMPLETE_LOGIN: {
      let newOverlay: Overlay | undefined = undefined;

      if (action.payload.user) {
        if (action.payload.user.catalogs.length) {
          history.push(`/catalog/${action.payload.user.catalogs[0].id}`);
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
    case CATALOG_CREATED: {
      if (state.serverState.user) {
        state.serverState.user.catalogs.push(action.payload);
      }

      history.push(`/catalog/${action.payload.id}`);
      return {
        ...state,
        overlay: undefined,
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
