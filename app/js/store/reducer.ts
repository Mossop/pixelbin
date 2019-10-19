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
  CATALOG_EDITED,
  SHOW_ALBUM_CREATE_OVERLAY,
  SHOW_ALBUM_EDIT_OVERLAY, 
  ALBUM_CREATED,
  ALBUM_EDITED } from "./actions";
import { StoreState, OverlayType, Overlay } from "./types";
import { history, HistoryState } from "../utils/history";
import { getCatalogForAlbum } from "./store";

function navigate(path: string, state?: LocationState): HistoryState {
  return history.pushWithoutDispatch(path, state);
}

function catalogReducer(state: StoreState, action: ActionType): StoreState {
  switch (action.type) {
    case SHOW_CATALOG_CREATE_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.CreateCatalog,
        }
      };
    }
    case CATALOG_CREATED: {
      if (state.serverState.user) {
        state.serverState.user.catalogs.set(action.payload.id, action.payload);
      }

      return {
        ...state,
        overlay: undefined,
        historyState: navigate(`/catalog/${action.payload.id}`),
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
    case CATALOG_EDITED: {
      if (state.serverState.user) {
        state.serverState.user.catalogs.set(action.payload.id, action.payload);
      }

      return {
        ...state,
        overlay: undefined,
      };
    }
  }

  return state;
}

function albumReducer(state: StoreState, action: ActionType): StoreState {
  switch (action.type) {
    case SHOW_ALBUM_CREATE_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.CreateAlbum,
          catalog: action.payload.catalog,
          parent: action.payload.parent,
        }
      };
    }
    case ALBUM_CREATED: {
      action.payload.catalog.albums.set(action.payload.album.id, action.payload.album);

      return {
        ...state,
        overlay: undefined,
        historyState: navigate(`/album/${action.payload.album.id}`),
      };
    }
    case SHOW_ALBUM_EDIT_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.EditAlbum,
          album: action.payload.album,
          catalog: action.payload.catalog,
        }
      };
    }
    case ALBUM_EDITED: {
      const { catalog, album } = action.payload;
      let oldCatalog = getCatalogForAlbum(album, state);
      if (oldCatalog && oldCatalog != catalog) {
        oldCatalog.albums.delete(album.id);
      }
      catalog.albums.set(album.id, album);

      return {
        ...state,
        overlay: undefined,
      };
    }
  }

  return state;
}

function authReducer(state: StoreState, action: ActionType): StoreState {
  switch (action.type) {
    case SHOW_LOGIN_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.Login,
        }
      };
    }
    case COMPLETE_LOGIN: {
      let newOverlay: Overlay | undefined = undefined;
      let historyState = state.historyState;

      if (action.payload.user) {
        if (action.payload.user.catalogs.size) {
          let catalogs = Array.from(action.payload.user.catalogs.values());
          // TODO sort them
          historyState = navigate(`/catalog/${catalogs[0]}`);
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
    case SHOW_SIGNUP_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.Signup,
        }
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
    case COMPLETE_LOGOUT: {
      return {
        ...state,
        serverState: action.payload,
        historyState: navigate("/"),
      };
    }
  }

  return state;
}

function mediaReducer(state: StoreState, action: ActionType): StoreState {
  switch (action.type) {
    case SHOW_UPLOAD_OVERLAY: {
      return {
        ...state,
        overlay: {
          type: OverlayType.Upload,
          catalog: action.payload.catalog,
          parent: action.payload.parent,
        }
      };
    }
  }

  return state;
}

export default function reducer(state: StoreState, action: ActionType): StoreState {
  switch (action.type) {
    case SET_HISTORY_STATE: {
      return {
        ...state,
        historyState: action.payload,
      };
    }
    case CLOSE_OVERLAY: {
      return {
        ...state,
        overlay: undefined,
      };
    }
  }

  state = authReducer(state, action);
  state = catalogReducer(state, action);
  state = albumReducer(state, action);
  state = mediaReducer(state, action);
  return state;
}
