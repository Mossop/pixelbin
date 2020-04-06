import { rootReducer } from "deeds/immer";
import { Draft } from "immer";

import { Catalog, Album, Reference } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import { CatalogData, AlbumData, TagData, PersonData, ServerData, UserData } from "../api/types";
import { OverlayType } from "../overlays";
import { PageType } from "../pages";
import { replaceState, pushState } from "../utils/navigation";
import { nameSorted } from "../utils/sort";
import { StoreState, UIState } from "./types";

type MappedReducer<S> =
  S extends (state: Draft<StoreState>, user: UserData, ...args: infer A) => void
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
  showCatalogCreateOverlay(state: Draft<StoreState>, _user: UserData): void {
    state.ui.overlay = {
      type: OverlayType.CreateCatalog,
    };
    replaceState(state.ui);
  },

  catalogCreated(state: Draft<StoreState>, user: UserData, catalog: CatalogData): void {
    user.catalogs.set(catalog.id, catalog);
    state.ui = {
      page: {
        type: PageType.Catalog,
        catalog: Catalog.ref(catalog),
      },
    };
    pushState(state.ui);
  },

  showCatalogEditOverlay(
    state: Draft<StoreState>,
    _user: UserData,
    catalog: Reference<Catalog>,
  ): void {
    state.ui.overlay = {
      type: OverlayType.EditCatalog,
      catalog: catalog,
    };
    replaceState(state.ui);
  },
};

const albumReducers = {
  showAlbumCreateOverlay(
    state: Draft<StoreState>,
    _user: UserData,
    parent: Reference<MediaTarget>,
  ): void {
    state.ui.overlay = {
      type: OverlayType.CreateAlbum,
      parent,
    };
    replaceState(state.ui);
  },

  albumCreated(state: Draft<StoreState>, user: UserData, album: AlbumData): void {
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
    pushState(state.ui);
  },

  showAlbumEditOverlay(state: Draft<StoreState>, _user: UserData, album: Reference<Album>): void {
    state.ui.overlay = {
      type: OverlayType.EditAlbum,
      album,
    };
    replaceState(state.ui);
  },

  albumEdited(state: Draft<StoreState>, user: UserData, album: AlbumData): void {
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
  },
};

const tagReducers = {
  tagsCreated(_state: Draft<StoreState>, user: UserData, tags: TagData[]): void {
    for (let tag of tags) {
      let catalog = user.catalogs.get(tag.catalog.id);
      if (catalog) {
        catalog.tags.set(tag.id, tag);
      }
    }
  },
};

const personReducers = {
  personCreated(_state: Draft<StoreState>, user: UserData, person: PersonData): void {
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
    replaceState(state.ui);
  },

  completeLogin(state: Draft<StoreState>, serverData: ServerData): void {
    state.serverState = serverData;

    if (serverData.user) {
      let catalogs = nameSorted(Array.from(serverData.user.catalogs.values()));
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
        if (!serverData.user.hadCatalog) {
          state.ui.overlay = {
            type: OverlayType.CreateCatalog,
          };
        }
      }

      pushState(state.ui);
    }
  },

  showSignupOverlay(state: Draft<StoreState>): void {
    state.ui.overlay = {
      type: OverlayType.Signup,
    };
    replaceState(state.ui);
  },

  completeSignup(state: Draft<StoreState>, serverData: ServerData): void {
    state.serverState = serverData;
    state.ui = {
      page: {
        type: PageType.User,
      },
      overlay: {
        type: OverlayType.CreateCatalog,
      },
    };
    pushState(state.ui);
  },

  completeLogout(state: Draft<StoreState>, serverData: ServerData): void {
    state.serverState = serverData;
    state.ui = {
      page: {
        type: PageType.Index,
      },
    };
    pushState(state.ui);
  },
};

const mediaReducers = {
  showUploadOverlay(state: Draft<StoreState>): void {
    state.ui.overlay = {
      type: OverlayType.Upload,
    };
    pushState(state.ui);
  },
};

export const reducers = {
  ...authedReducers(catalogReducers),
  ...authedReducers(albumReducers),
  ...authedReducers(personReducers),
  ...authedReducers(tagReducers),
  ...authedReducers(mediaReducers),
  ...authReducers,

  bumpState(state: Draft<StoreState>): void {
    state.stateId++;
  },

  historyStateChanged(state: Draft<StoreState>, uiState: Draft<UIState>): void {
    state.ui = uiState;
  },

  navigate(state: Draft<StoreState>, uiState: Draft<UIState>, replace: boolean = false): void {
    state.ui = uiState;
    if (replace) {
      replaceState(state.ui);
    } else {
      pushState(state.ui);
    }
  },

  closeOverlay(state: Draft<StoreState>): void {
    state.ui.overlay = undefined;
    replaceState(state.ui);
  },
};

export default rootReducer<StoreState>(reducers);
