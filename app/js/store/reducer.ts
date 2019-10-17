import { LocationState } from "history";

import { ActionType,
  SET_HISTORY_STATE,
  SHOW_LOGIN_OVERLAY,
  SHOW_SIGNUP_OVERLAY,
  SHOW_CATALOG_CREATE_OVERLAY,
  COMPLETE_LOGIN,
  COMPLETE_SIGNUP,
  COMPLETE_LOGOUT,
  CLOSE_OVERLAY,
  CATALOG_CREATED,
  SHOW_UPLOAD_OVERLAY,
  SHOW_CATALOG_EDIT_OVERLAY,
  CATALOG_EDITED} from "./actions";
import { StoreState, OverlayType, Overlay } from "./types";
import { history, HistoryState } from "../utils/history";
import { Catalog } from "../api/types";

function navigate(path: string, state?: LocationState): HistoryState {
  return history.pushWithoutDispatch(path, state);
}

export default function reducer(state: StoreState, action: ActionType): StoreState {
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
    case SHOW_CATALOG_EDIT_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.EditCatalog,
          catalog: action.payload,
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
    case CATALOG_EDITED: {
      if (state.serverState.user) {
        state.serverState.user.catalogs = state.serverState.user.catalogs
          .filter((c: Catalog): boolean => c.id !== action.payload.id);
        state.serverState.user.catalogs.push(action.payload);
      }

      return {
        ...state,
        overlay: undefined,
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
    case SHOW_UPLOAD_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.Upload,
          catalog: action.payload.catalog,
          album: action.payload.album,
        }
      };
    }
  }

  return state;
}
