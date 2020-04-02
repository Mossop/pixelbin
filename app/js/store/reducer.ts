import { produce, Draft } from "immer";

import { Catalog, Album } from "../api/highlevel";
import { UserData } from "../api/types";
import { OverlayType } from "../overlays";
import { PageType } from "../pages";
import { replaceState, pushState } from "../utils/navigation";
import { nameSorted } from "../utils/sort";
import { ActionType,
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
  BUMP_STATE,
  TAGS_CREATED,
  PERSON_CREATED,
  HISTORY_STATE_CHANGED} from "./actions";
import { StoreState } from "./types";

function catalogReducer(state: Draft<StoreState>, user: UserData, action: ActionType): void {
  switch (action.type) {
    case SHOW_CATALOG_CREATE_OVERLAY: {
      state.ui.overlay = {
        type: OverlayType.CreateCatalog,
      };
      replaceState(state.ui);
      return;
    }
    case CATALOG_CREATED: {
      user.catalogs.set(action.payload.catalog.id, action.payload.catalog);
      state.ui = {
        page: {
          type: PageType.Catalog,
          catalog: Catalog.ref(action.payload.catalog),
        }
      };
      pushState(state.ui);
      return;
    }
    case SHOW_CATALOG_EDIT_OVERLAY: {
      state.ui.overlay = {
        type: OverlayType.EditCatalog,
        catalog: action.payload.catalog,
      };
      replaceState(state.ui);
      return;
    }
  }
}

function albumReducer(state: Draft<StoreState>, user: UserData, action: ActionType): void {
  switch (action.type) {
    case SHOW_ALBUM_CREATE_OVERLAY: {
      state.ui.overlay = {
        type: OverlayType.CreateAlbum,
        parent: action.payload.parent,
      };
      replaceState(state.ui);
      return;
    }
    case ALBUM_CREATED: {
      let album = action.payload.album;
      let catalog = user.catalogs.get(album.catalog.id);
      if (catalog) {
        catalog.albums.set(album.id, album);
      }

      state.ui = {
        page: {
          type: PageType.Album,
          album: Album.ref(album),
        }
      };
      pushState(state.ui);
      return;
    }
    case SHOW_ALBUM_EDIT_OVERLAY: {
      state.ui.overlay = {
        type: OverlayType.EditAlbum,
        album: action.payload.album,
      };
      replaceState(state.ui);
      return;
    }
    case ALBUM_EDITED: {
      let album = action.payload.album;
      let newCatalog = user.catalogs.get(album.catalog.id);
      if (newCatalog) {
        for (let catalog of user.catalogs.values()) {
          if (catalog != newCatalog && catalog.albums.has(album.id)) {
            catalog.albums.delete(album.id);
            break;
          }
        }
        newCatalog.albums.set(album.id, album);
      }

      state.ui.overlay = undefined;
      replaceState(state.ui);
      return;
    }
  }
}

function tagReducer(_state: Draft<StoreState>, user: UserData, action: ActionType): void {
  switch (action.type) {
    case TAGS_CREATED: {
      let tags = action.payload.tags;
      for (let tag of tags) {
        let catalog = user.catalogs.get(tag.catalog.id);
        if (catalog) {
          catalog.tags.set(tag.id, tag);
        }
      }
      return;
    }
  }
}

function personReducer(_state: Draft<StoreState>, user: UserData, action: ActionType): void {
  switch (action.type) {
    case PERSON_CREATED: {
      let person = action.payload.person;
      let catalog = user.catalogs.get(person.catalog.id);
      if (catalog) {
        catalog.people.set(person.id, person);
      }
      return;
    }
  }
}

function authReducer(state: Draft<StoreState>, action: ActionType): void {
  switch (action.type) {
    case SHOW_LOGIN_OVERLAY: {
      state.ui.overlay = {
        type: OverlayType.Login,
      };
      replaceState(state.ui);
      return;
    }
    case COMPLETE_LOGIN: {
      state.serverState = action.payload;

      if (action.payload.user) {
        let catalogs = nameSorted(Array.from(action.payload.user.catalogs.values()));
        if (catalogs.length) {
          state.ui = {
            page: {
              type: PageType.Catalog,
              catalog: Catalog.ref(catalogs[0]),
            }
          };
        } else {
          state.ui = {
            page: {
              type: PageType.User,
            },
          };
          if (!action.payload.user.hadCatalog) {
            state.ui.overlay = {
              type: OverlayType.CreateCatalog,
            };
          }
        }

        pushState(state.ui);
      }
      return;
    }
    case SHOW_SIGNUP_OVERLAY: {
      state.ui.overlay = {
        type: OverlayType.Signup,
      };
      replaceState(state.ui);
      return;
    }
    case COMPLETE_SIGNUP: {
      state.serverState = action.payload;
      state.ui = {
        page: {
          type: PageType.User,
        },
        overlay: {
          type: OverlayType.CreateCatalog,
        },
      };
      pushState(state.ui);
      return;
    }
    case COMPLETE_LOGOUT: {
      state.serverState = action.payload;
      state.ui = {
        page: {
          type: PageType.Index,
        },
      };
      pushState(state.ui);
      return;
    }
  }
}

function mediaReducer(state: Draft<StoreState>, action: ActionType): void {
  switch (action.type) {
    case SHOW_UPLOAD_OVERLAY: {
      state.ui.overlay = {
        type: OverlayType.Upload,
      };
      pushState(state.ui);
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
    case HISTORY_STATE_CHANGED: {
      state.ui = action.payload;
      return;
    }
    case CLOSE_OVERLAY: {
      state.ui.overlay = undefined;
      replaceState(state.ui);
      return;
    }
  }

  authReducer(state, action);
  mediaReducer(state, action);
  if (state.serverState.user) {
    catalogReducer(state, state.serverState.user, action);
    albumReducer(state, state.serverState.user, action);
    tagReducer(state, state.serverState.user, action);
    personReducer(state, state.serverState.user, action);
  }
}

export default function(state: StoreState, action: ActionType): StoreState {
  return produce(state, (draft: Draft<StoreState>) => {
    reducer(draft, action);
  });
}
