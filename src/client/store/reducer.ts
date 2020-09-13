import { reducer } from "deeds/immer";
import { Draft } from "immer";

import { Catalog, Album, Reference } from "../api/highlevel";
import type { MediaTarget } from "../api/media";
import type {
  CatalogState,
  AlbumState,
  TagState,
  PersonState,
  ServerState,
  UserState,
  StorageState,
} from "../api/types";
import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import { createDraft } from "../utils/helpers";
import { nameSorted } from "../utils/sort";
import { StoreState, UIState } from "./types";

type MappedReducer<S> =
  S extends (state: Draft<StoreState>, user: Draft<UserState>, ...args: infer A) => void
    ? (state: Draft<StoreState>, ...args: A) => void
    : S;

type MappedReducers<M> = {
  [K in keyof M]: MappedReducer<M[K]>;
};

function authedReducers<M>(reducers: M): MappedReducers<M> {
  let result = {};
  for (let [key, reducer] of Object.entries(reducers)) {
    result[key] = (state: Draft<StoreState>, ...args: unknown[]): void => {
      if (!state.serverState.user) {
        return;
      }

      reducer(state, state.serverState.user, ...args);
    };
  }
  return result as MappedReducers<M>;
}

const catalogReducers = {
  showCatalogCreateOverlay(state: Draft<StoreState>, _user: Draft<UserState>): void {
    state.ui.overlay = {
      type: OverlayType.CreateCatalog,
    };
  },

  storageCreated(state: Draft<StoreState>, user: Draft<UserState>, storage: StorageState): void {
    user.storage.set(storage.id, storage);
  },

  catalogCreated(state: Draft<StoreState>, user: Draft<UserState>, catalog: CatalogState): void {
    user.catalogs.set(catalog.id, createDraft(catalog));
    state.ui = {
      page: {
        type: PageType.Catalog,
        catalog: Catalog.ref(catalog),
      },
    };
  },

  showCatalogEditOverlay(
    state: Draft<StoreState>,
    _user: Draft<UserState>,
    catalog: Reference<Catalog>,
  ): void {
    state.ui.overlay = {
      type: OverlayType.EditCatalog,
      catalog: catalog,
    };
  },
};

const albumReducers = {
  showAlbumCreateOverlay(
    state: Draft<StoreState>,
    _user: Draft<UserState>,
    parent: Reference<MediaTarget>,
  ): void {
    state.ui.overlay = {
      type: OverlayType.CreateAlbum,
      parent,
    };
  },

  albumCreated(state: Draft<StoreState>, user: Draft<UserState>, album: AlbumState): void {
    let catalog = user.catalogs.get(album.catalog.id);
    if (catalog) {
      catalog.albums.set(album.id, album);
    }

    state.ui = {
      page: {
        type: PageType.Album,
        album: Album.ref(album),
      },
    };
  },

  showAlbumEditOverlay(
    state: Draft<StoreState>,
    _user: Draft<UserState>,
    album: Reference<Album>,
  ): void {
    state.ui.overlay = {
      type: OverlayType.EditAlbum,
      album,
    };
  },

  albumEdited(state: Draft<StoreState>, user: Draft<UserState>, album: AlbumState): void {
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
  },
};

const tagReducers = {
  tagsCreated(_state: Draft<StoreState>, user: Draft<UserState>, tags: readonly TagState[]): void {
    for (let tag of tags) {
      let catalog = user.catalogs.get(tag.catalog.id);
      if (catalog) {
        catalog.tags.set(tag.id, tag);
      }
    }
  },
};

const personReducers = {
  personCreated(_state: Draft<StoreState>, user: Draft<UserState>, person: PersonState): void {
    let catalog = user.catalogs.get(person.catalog.id);
    if (catalog) {
      catalog.people.set(person.id, person);
    }
  },
};

const authReducers = {
  showLoginOverlay(state: Draft<StoreState>): void {
    state.ui.overlay = {
      type: OverlayType.Login,
    };
  },

  completeLogin(state: Draft<StoreState>, serverState: ServerState): void {
    state.serverState = createDraft(serverState);

    if (serverState.user) {
      let catalogs = nameSorted(serverState.user.catalogs);
      if (catalogs.length) {
        state.ui = {
          page: {
            type: PageType.Catalog,
            catalog: Catalog.ref(catalogs[0]),
          },
        };
      } else {
        state.ui = {
          page: {
            type: PageType.User,
          },
        };
        if (!serverState.user.catalogs.size) {
          state.ui.overlay = {
            type: OverlayType.CreateCatalog,
          };
        }
      }
    }
  },

  showSignupOverlay(state: Draft<StoreState>): void {
    state.ui.overlay = {
      type: OverlayType.Signup,
    };
  },

  completeSignup(state: Draft<StoreState>, serverData: ServerState): void {
    state.serverState = createDraft(serverData);
    state.ui = {
      page: {
        type: PageType.User,
      },
      overlay: {
        type: OverlayType.CreateCatalog,
      },
    };
  },

  completeLogout(state: Draft<StoreState>, serverData: ServerState): void {
    state.serverState = createDraft(serverData);
    state.ui = {
      page: {
        type: PageType.Index,
      },
    };
  },
};

const mediaReducers = {
};

export const reducers = {
  ...authedReducers(catalogReducers),
  ...authedReducers(albumReducers),
  ...authedReducers(personReducers),
  ...authedReducers(tagReducers),
  ...authedReducers(mediaReducers),
  ...authReducers,

  updateServerState(state: Draft<StoreState>, serverState: ServerState): void {
    state.serverState = createDraft(serverState);
  },

  updateUIState(state: Draft<StoreState>, uiState: Draft<UIState>): void {
    // It is important that this object not be modified in any way.
    state.ui = uiState;
  },

  navigate(state: Draft<StoreState>, uiState: UIState): void {
    state.ui = createDraft(uiState);
  },

  closeOverlay(state: Draft<StoreState>): void {
    state.ui.overlay = undefined;
  },
};

export default reducer(reducers);
