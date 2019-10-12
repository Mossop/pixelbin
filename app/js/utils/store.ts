import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { history, HistoryState } from "./history";

import { ActionType,
  SET_HISTORY_STATE,
  SHOW_LOGIN_OVERLAY,
  SHOW_SIGNUP_OVERLAY,
  SHOW_CATALOG_CREATE_OVERLAY,
  COMPLETE_LOGIN,
  COMPLETE_SIGNUP,
  COMPLETE_LOGOUT,
  CLOSE_OVERLAY, 
  CATALOG_CREATED} from "./actions";
import { StoreState, OverlayType, Overlay, ServerStateDecoder, decode } from "../types";
import { LocationState } from "history";

function navigate(path: string, state?: LocationState): HistoryState {
  return history.pushWithoutDispatch(path, state);
}

function reducer(state: StoreState, action: ActionType): StoreState {
  switch (action.type) {
    case SET_HISTORY_STATE: {
      console.log("Update state");
      return {
        ...state,
        historyState: action.payload,
      };
    }
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
      let historyState = state.historyState;

      if (action.payload.user) {
        if (action.payload.user.catalogs.length) {
          historyState = navigate(`/catalog/${action.payload.user.catalogs[0].id}`);
        } else {
          historyState = navigate("/user");
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
        historyState,
      };
    }
    case COMPLETE_SIGNUP: {
      return {
        ...state,
        serverState: action.payload,
        overlay: {
          type: OverlayType.CreateCatalog,
        },
        historyState: navigate("/user"),
      };
    }
    case CATALOG_CREATED: {
      if (state.serverState.user) {
        state.serverState.user.catalogs.push(action.payload);
      }

      return {
        ...state,
        overlay: undefined,
        historyState: navigate(`/catalog/${action.payload.id}`),
      };
    }
    case COMPLETE_LOGOUT: {
      return {
        ...state,
        serverState: action.payload,
        historyState: navigate("/"),
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

function buildStore(): Store<StoreState, ActionType> {
  let initialState: StoreState = { serverState: { }, historyState: null };
  let stateElement = document.getElementById("initial-state");
  if (stateElement && stateElement.textContent) {
    try {
      initialState.serverState = decode(ServerStateDecoder, JSON.parse(stateElement.textContent));
    } catch (e) {
      console.error(e);
    }
  }

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

const store = buildStore();
export default store;
