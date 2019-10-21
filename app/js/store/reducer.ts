import { LocationState } from "history";
import produce, { Draft } from "immer";

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
import { StoreState, OverlayType } from "./types";
import { history, HistoryState } from "../utils/history";
import { UserState } from "../api/types";
import { catalogNameSorted } from "../utils/sort";

function navigate(path: string, state?: LocationState): HistoryState {
  return history.pushWithoutDispatch(path, state);
}

function catalogReducer(state: Draft<StoreState>, user: Draft<UserState>, action: ActionType): void {
  switch (action.type) {
    case SHOW_CATALOG_CREATE_OVERLAY: {
      state.overlay = {
        type: OverlayType.CreateCatalog,
      };
      return;
    }
    case CATALOG_CREATED: {
      user.catalogs[action.payload.id] = action.payload;
      state.overlay = undefined;
      state.historyState = navigate(`/album/${action.payload.root.id}`);
      return;
    }
    case SHOW_CATALOG_EDIT_OVERLAY: {
      state.overlay = {
        type: OverlayType.EditCatalog,
        catalog: action.payload,
      };
      return;
    }
    case CATALOG_EDITED: {
      user.catalogs[action.payload.id] = action.payload;
      state.overlay = undefined;
    }
  }
}

function albumReducer(state: Draft<StoreState>, user: Draft<UserState>, action: ActionType): void {
  switch (action.type) {
    case SHOW_ALBUM_CREATE_OVERLAY: {
      state.overlay = {
        type: OverlayType.CreateAlbum,
        parent: action.payload,
      };
      return;
    }
    case ALBUM_CREATED: {
      const { catalog, album } = action.payload;
      for (let [id, current] of Object.entries(user.catalogs)) {
        if (id === catalog.id) {
          current.albums[album.id] = album;
        }
      }

      state.overlay = undefined;
      state.historyState = navigate(`/album/${action.payload.album.id}`);
      return;
    }
    case SHOW_ALBUM_EDIT_OVERLAY: {
      state.overlay = {
        type: OverlayType.EditAlbum,
        album: action.payload,
      };
      return;
    }
    case ALBUM_EDITED: {
      state.overlay = undefined;

      const { catalog, album } = action.payload;
      for (let [id, current] of Object.entries(user.catalogs)) {
        if (id === catalog.id) {
          current.albums[album.id] = album;
        } else if (album.id in current.albums) {
          delete current.albums[album.id];
        }
      }
      return;
    }
  }
}

function authReducer(state: Draft<StoreState>, action: ActionType): void {
  switch (action.type) {
    case SHOW_LOGIN_OVERLAY: {
      state.overlay = {
        type: OverlayType.Login,
      };
      return;
    }
    case COMPLETE_LOGIN: {
      state.serverState = action.payload;

      if (action.payload.user) {
        let catalogs = catalogNameSorted(action.payload.user.catalogs);
        if (catalogs.length) {
          state.historyState = navigate(`/album/${catalogs[0].root.id}`);
        } else {
          state.historyState = navigate("/user");
          if (!action.payload.user.hadCatalog) {
            state.overlay = {
              type: OverlayType.CreateCatalog,
            };
          }
        }
      }
      return;
    }
    case SHOW_SIGNUP_OVERLAY: {
      state.overlay = {
        type: OverlayType.Signup,
      };
      return;
    }
    case COMPLETE_SIGNUP: {
      state.serverState = action.payload;
      state.overlay = {
        type: OverlayType.CreateCatalog,
      };
      state.historyState = navigate("/user");
      return;
    }
    case COMPLETE_LOGOUT: {
      state.serverState = action.payload;
      state.historyState = navigate("/");
      return;
    }
  }
}

function mediaReducer(state: Draft<StoreState>, action: ActionType): void {
  switch (action.type) {
    case SHOW_UPLOAD_OVERLAY: {
      state.overlay = {
        type: OverlayType.Upload,
        parent: action.payload,
      };
      return;
    }
  }
}

function reducer(state: Draft<StoreState>, action: ActionType): void {
  switch (action.type) {
    case SET_HISTORY_STATE: {
      state.historyState = action.payload;
      return;
    }
    case CLOSE_OVERLAY: {
      state.overlay = undefined;
      return;
    }
  }

  authReducer(state, action);
  mediaReducer(state, action);
  if (state.serverState.user) {
    catalogReducer(state, state.serverState.user, action);
    albumReducer(state, state.serverState.user, action);
  }
}

export default function(state: StoreState, action: ActionType): StoreState {
  return produce(state, (draft: Draft<StoreState>) => {
    reducer(draft, action);
  });
}
