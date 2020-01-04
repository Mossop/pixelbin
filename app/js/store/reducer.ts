import { LocationState } from "history";

import { produce, Draft } from "../utils/immer";
import { history, HistoryState } from "../utils/history";
import { UserState } from "../api/types";
import { catalogNameSorted } from "../utils/sort";
import { mapValues } from "../utils/maps";
import { StoreState, OverlayType } from "./types";
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
  SHOW_ALBUM_CREATE_OVERLAY,
  SHOW_ALBUM_EDIT_OVERLAY,
  ALBUM_CREATED,
  ALBUM_EDITED, 
  BUMP_STATE} from "./actions";

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
      user.catalogs.set(action.payload.id, action.payload);
      state.overlay = undefined;
      state.historyState = navigate(`/catalog/${action.payload.id}`);
      return;
    }
    case SHOW_CATALOG_EDIT_OVERLAY: {
      state.overlay = {
        type: OverlayType.EditCatalog,
        catalog: action.payload.id,
      };
      return;
    }
  }
}

function albumReducer(state: Draft<StoreState>, user: Draft<UserState>, action: ActionType): void {
  switch (action.type) {
    case SHOW_ALBUM_CREATE_OVERLAY: {
      state.overlay = {
        type: OverlayType.CreateAlbum,
        parent: action.payload.id,
      };
      return;
    }
    case ALBUM_CREATED: {
      let album = action.payload;
      for (let catalog of mapValues(user.catalogs)) {
        if (album.parent && album.parent in catalog.albums) {
          catalog.albums[album.id] = album;
        }
      }

      state.overlay = undefined;
      state.historyState = navigate(`/album/${album.id}`);
      return;
    }
    case SHOW_ALBUM_EDIT_OVERLAY: {
      if (!action.payload.parent) {
        return;
      }

      state.overlay = {
        type: OverlayType.EditAlbum,
        album: action.payload.id,
        parent: action.payload.parent,
      };

      return;
    }
    case ALBUM_EDITED: {
      let album = action.payload;
      for (let catalog of mapValues(user.catalogs)) {
        if (catalog.albums.has(album.id)) {
          catalog.albums.delete(album.id);
        }
        if (album.parent && catalog.albums.has(album.parent)) {
          catalog.albums.set(album.id, album);
        }
      }

      state.overlay = undefined;
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
          state.historyState = navigate(`/catalog/${catalogs[0].id}`);
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
        parent: action.payload.id,
      };
      return;
    }
  }
}

function reducer(state: Draft<StoreState>, action: ActionType): void {
  switch (action.type) {
    case BUMP_STATE: {
      state.stateId++;
      return;
    }
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
