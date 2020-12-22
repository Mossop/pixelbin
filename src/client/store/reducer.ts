import { reducer } from "deeds/immer";
import type { Draft } from "immer";

import { nameSorted } from "../../utils/sort";
import type { Reference } from "../api/highlevel";
import { SavedSearch, Catalog, Album } from "../api/highlevel";
import type {
  CatalogState,
  AlbumState,
  ServerState,
  UserState,
  StorageState,
  SavedSearchState,
} from "../api/types";
import type { DialogState } from "../dialogs/types";
import { DialogType } from "../dialogs/types";
import { PageType } from "../pages/types";
import { createDraft } from "../utils/helpers";
import { pushUIState, replaceUIState } from "../utils/navigation";
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

    let {
      dialog,
      ...uiState
    } = state.ui;

    state.ui = replaceUIState(uiState);
  },

  storageCreated(state: Draft<StoreState>, user: Draft<UserState>, storage: StorageState): void {
    user.storage.set(storage.id, storage);
  },

  catalogCreated(state: Draft<StoreState>, user: Draft<UserState>, catalog: CatalogState): void {
    user.catalogs.set(catalog.id, createDraft(catalog));
    state.ui = pushUIState({
      page: {
        type: PageType.Catalog,
        catalog: Catalog.ref(catalog),
      },
    });
  },

  searchSaved(state: Draft<StoreState>, user: Draft<UserState>, search: SavedSearchState): void {
    let catalog = user.catalogs.get(search.catalog.id);
    if (catalog) {
      catalog.searches.set(search.id, createDraft(search));
    }

    state.ui = pushUIState({
      page: {
        type: PageType.SavedSearch,
        search: SavedSearch.ref(search),
      },
    });
  },

  searchDeleted(
    state: Draft<StoreState>,
    user: Draft<UserState>,
    searchRef: Reference<SavedSearch>,
  ): void {
    for (let catalog of user.catalogs.values()) {
      let search = catalog.searches.get(searchRef.id);
      if (search) {
        catalog.searches.delete(searchRef.id);

        if (state.ui.page.type == PageType.SavedSearch && state.ui.page.search.id == search.id) {
          state.ui = pushUIState({
            page: {
              type: PageType.Catalog,
              catalog: Catalog.ref(catalog),
            },
          });
          return;
        }
        break;
      }
    }

    let {
      dialog,
      ...uiState
    } = state.ui;

    state.ui = replaceUIState(uiState);
  },
};

const albumReducers = {
  albumCreated(state: Draft<StoreState>, user: Draft<UserState>, album: AlbumState): void {
    let catalog = user.catalogs.get(album.catalog.id);
    if (catalog) {
      catalog.albums.set(album.id, album);
    }

    state.ui = pushUIState({
      page: {
        type: PageType.Album,
        album: Album.ref(album),
      },
    });
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

    let {
      dialog,
      ...uiState
    } = state.ui;

    state.ui = replaceUIState(uiState);
  },

  albumDeleted(state: Draft<StoreState>, user: Draft<UserState>, albumRef: Reference<Album>): void {
    let newUIState = state.ui;

    let deleteAlbum = (catalog: Draft<CatalogState>, album: AlbumState): void => {
      for (let child of [...catalog.albums.values()]) {
        if (child.parent?.id == album.id) {
          deleteAlbum(catalog, child);
        }
      }

      catalog.albums.delete(album.id);

      if (newUIState.page.type == PageType.Album && newUIState.page.album.id == album.id) {
        if (album.parent) {
          newUIState = {
            page: {
              type: PageType.Album,
              album: album.parent,
            },
          };
        } else {
          newUIState = {
            page: {
              type: PageType.Catalog,
              catalog: album.catalog,
            },
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

    if (newUIState !== state.ui) {
      state.ui = pushUIState(newUIState);
    } else {
      let {
        dialog,
        ...uiState
      } = state.ui;

      state.ui = replaceUIState(uiState);
    }
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
      let catalogs = nameSorted([...serverState.user.catalogs.values()]);
      if (catalogs.length) {
        state.ui = replaceUIState({
          page: {
            type: PageType.Catalog,
            catalog: Catalog.ref(catalogs[0]),
          },
        });
      } else {
        state.ui = replaceUIState({
          page: {
            type: PageType.User,
          },
        });
        if (!serverState.user.catalogs.size) {
          state.ui = replaceUIState({
            ...state.ui,
            dialog: {
              type: DialogType.CatalogCreate,
            },
          });
        }
      }
    }
  },

  completeSignup(state: Draft<StoreState>, serverData: ServerState): void {
    state.serverState = createDraft(serverData);
    state.ui = replaceUIState({
      page: {
        type: PageType.User,
      },
      dialog: {
        type: DialogType.CatalogCreate,
      },
    });
  },

  completeLogout(state: Draft<StoreState>, serverData: ServerState): void {
    state.serverState = createDraft(serverData);
    state.ui = pushUIState({
      page: {
        type: PageType.Root,
      },
    });
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

  setUIState(state: Draft<StoreState>, uiState: UIState): void {
    state.ui = uiState as Draft<UIState>;
  },

  pushUIState(state: Draft<StoreState>, uiState: Partial<UIState>): void {
    state.ui = pushUIState({
      ...state.ui,
      ...uiState,
    });
  },

  replaceUIState(state: Draft<StoreState>, uiState: Partial<UIState>): void {
    state.ui = replaceUIState({
      ...state.ui,
      ...uiState,
    });
  },

  showDialog(state: Draft<StoreState>, dialog: Draft<DialogState>): void {
    state.ui = replaceUIState({
      ...state.ui,
      dialog,
    });
  },

  closeDialog(state: Draft<StoreState>): void {
    let {
      dialog,
      ...uiState
    } = state.ui;

    state.ui = replaceUIState(uiState);
  },
};

export default reducer(reducers);
