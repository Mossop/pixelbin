import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { Catalog, ServerStateDecoder, Album, ServerState } from "../api/types";
import { decode } from "../utils/decoders";
import { MapId, intoId, mapValues, mapIncludes } from "../utils/maps";
import { nameSorted } from "../utils/sort";
import { exception, ErrorCode } from "../utils/exception";
import { ActionType } from "./actions";
import { StoreState } from "./types";
import reducer from "./reducer";

function buildStore(): Store<StoreState, ActionType> {
  let initialServerState: ServerState = {};
  let stateElement = document.getElementById("initial-state");
  if (stateElement && stateElement.textContent) {
    try {
      initialServerState = decode(ServerStateDecoder, JSON.parse(stateElement.textContent));
    } catch (e) {
      console.error(e);
    }
  }

  let initialState: StoreState = {
    serverState: initialServerState,
    settings: {
      thumbnailSize: 150,
    },
    historyState: null,
    stateId: 0,
  };

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

// Something about the history state is messing up type inference, this is the
// only part of the state we care about anyway.
type ServerStoreState = Pick<StoreState, "serverState">;

export function getCatalog(id: string, state?: ServerStoreState): Catalog {
  if (!state) {
    state = store.getState();
  }

  if (!state.serverState.user) {
    exception(ErrorCode.NotLoggedIn);
  }

  let catalog: Catalog | undefined = state.serverState.user.catalogs.get(id);
  if (!catalog) {
    exception(ErrorCode.UnknownCatalog);
  }

  return catalog;
}

export function getCatalogForAlbum(album: MapId<Album>, state?: ServerStoreState): Catalog {
  if (!state) {
    state = store.getState();
  }

  let id = intoId(album);
  if (!state.serverState.user) {
    exception(ErrorCode.NotLoggedIn);
  }

  for (let catalog of mapValues(state.serverState.user.catalogs)) {
    if (mapIncludes(catalog.albums, id)) {
      return catalog;
    }
  }

  exception(ErrorCode.UnknownCatalog);
}

export function getAlbum(album: MapId<Album>, state?: ServerStoreState): Album {
  if (typeof album === "string") {
    let found = getCatalogForAlbum(album, state).albums.get(album);
    if (!found) {
      exception(ErrorCode.UnknownAlbum);
    }
    return found;
  }
  return album;
}

export function getCatalogRoot(catalog: MapId<Catalog>, state?: ServerStoreState): Album {
  let cat: Catalog = getCatalog(intoId(catalog), state);
  let album = cat.albums.get(cat.root);
  if (!album) {
    exception(ErrorCode.UnknownAlbum);
  }
  return album;
}

export function getCatalogAlbum(catalog: MapId<Catalog>, album: MapId<Album>, state?: ServerStoreState): Album {
  let cat: Catalog = getCatalog(intoId(catalog), state);
  if (!mapIncludes(cat.albums, album)) {
    exception(ErrorCode.UnknownAlbum);
  }

  if (typeof album === "string") {
    let found = cat.albums.get(album);
    if (!found) {
      exception(ErrorCode.UnknownAlbum);
    }
    return found;
  }
  return album;
}

export function albumChildren(album: MapId<Album>, catalog?: Catalog): Album[] {
  let parent = intoId(album);
  catalog = catalog ? catalog : getCatalogForAlbum(album);
  return nameSorted(mapValues(catalog.albums).filter((a: Album) => a.parent == parent));
}

export function isAncestor(maybeAncestor: MapId<Album>, album: MapId<Album>, state?: ServerStoreState): boolean {
  if (!state) {
    state = store.getState();
  }

  if (!state.serverState.user) {
    exception(ErrorCode.NotLoggedIn);
  }

  let ancestorId = intoId(maybeAncestor);
  let descendent = getAlbum(album, state);

  // No parent, cannot be an ancestor.
  if (!descendent.parent) {
    return false;
  }

  // Simple case
  if (descendent.parent === ancestorId) {
    return true;
  }

  for (let catalog of mapValues(state.serverState.user.catalogs)) {
    if (mapIncludes(catalog.albums, ancestorId)) {
      // If they aren't in the same catalog then cannot be an ancestor.
      if (!mapIncludes(catalog.albums, descendent)) {
        return false;
      }

      let parent: Album | undefined = catalog.albums.get(descendent.parent);
      while (parent) {
        if (parent.parent === ancestorId) {
          return true;
        }
      }

      return false;
    }
  }

  exception(ErrorCode.UnknownCatalog);
}

export default store;
