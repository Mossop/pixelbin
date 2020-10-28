import { reducer } from "deeds/immer";
import type { Draft } from "immer";

import type { Reference } from "../api/highlevel";
import { Catalog, Album } from "../api/highlevel";
import type {
  CatalogState,
  AlbumState,
  ServerState,
  UserState,
  StorageState,
  SavedSearchState,
} from "../api/types";
import type { OverlayState } from "../overlays/types";
import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import { createDraft } from "../utils/helpers";
import { nameSorted } from "../utils/sort";
import type { StoreState, UIState } from "./types";

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
  catalogEdited(
    state: Draft<StoreState>,
    user: Draft<UserState>,
    catalog: Omit<CatalogState, "albums" | "tags" | "people" | "searches">,
  ): void {
    let existing = user.catalogs.get(catalog.id);
    if (existing) {
      user.catalogs.set(catalog.id, {
        ...existing,
        ...catalog,
      });
    }

    delete state.ui.overlay;
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

  searchSaved(state: Draft<StoreState>, user: Draft<UserState>, search: SavedSearchState): void {
    let catalog = user.catalogs.get(search.catalog.id);
    if (catalog) {
      catalog.searches.set(search.id, createDraft(search));
    }

    state.ui = {
      page: {
        type: PageType.SavedSearch,
        searchId: search.id,
      },
    };
  },
};

const albumReducers = {
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

    delete state.ui.overlay;
  },

  albumDeleted(state: Draft<StoreState>, user: Draft<UserState>, albumRef: Reference<Album>): void {
    let deleteAlbum = (catalog: Draft<CatalogState>, album: AlbumState): void => {
      for (let child of [...catalog.albums.values()]) {
        if (child.parent?.id == album.id) {
          deleteAlbum(catalog, child);
        }
      }
      catalog.albums.delete(album.id);
      if (state.ui.page.type == PageType.Album && state.ui.page.album.id == album.id) {
        if (album.parent) {
          state.ui.page.album = album.parent;
        } else {
          state.ui.page = {
            type: PageType.Catalog,
            catalog: album.catalog,
          };
        }
      }
    };

    for (let catalog of user.catalogs.values()) {
      let album = catalog.albums.get(albumRef.id);
      if (album) {
        deleteAlbum(catalog, album);
        break;
      }
    }

    delete state.ui.overlay;
  },
};

const tagReducers = {
};

const personReducers = {
};

const authReducers = {
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
            type: OverlayType.CatalogCreate,
          };
        }
      }
    }
  },

  completeSignup(state: Draft<StoreState>, serverData: ServerState): void {
    state.serverState = createDraft(serverData);
    state.ui = {
      page: {
        type: PageType.User,
      },
      overlay: {
        type: OverlayType.CatalogCreate,
      },
    };
  },

  completeLogout(state: Draft<StoreState>, serverData: ServerState): void {
    state.serverState = createDraft(serverData);
    state.ui = {
      page: {
        type: PageType.Root,
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
  ...mediaReducers,
  ...authReducers,

  updateServerState(state: Draft<StoreState>, serverState: ServerState): void {
    state.serverState = createDraft(serverState);
  },

  showOverlay(state: Draft<StoreState>, overlay: Draft<OverlayState>): void {
    state.ui.overlay = overlay;
  },

  navigate(state: Draft<StoreState>, uiState: UIState): void {
    // It is important that this object not be modified in any way.
    state.ui = uiState as Draft<UIState>;
  },

  closeOverlay(state: Draft<StoreState>): void {
    delete state.ui.overlay;
  },
};

export default reducer(reducers);
