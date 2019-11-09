import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import reducer from "./reducer";
import { StoreState } from "./types";
import { ActionType } from "./actions";
import { Catalog, ServerStateDecoder, Album, ServerState } from "../api/types";
import { decode } from "../utils/decoders";
import { MapId, intoId } from "../utils/maps";
import { nameSorted } from "../utils/sort";

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

export function getCatalog(id: string, state?: ServerStoreState): Catalog | undefined {
  if (!state) {
    state = store.getState();
  }

  if (!state.serverState.user) {
    return undefined;
  }

  return state.serverState.user.catalogs[id];
}

export function getCatalogForAlbum(album: MapId<Album>, state?: ServerStoreState): Catalog {
  if (!state) {
    state = store.getState();
  }

  let id = intoId(album);
  if (!state.serverState.user) {
    throw new Error("Attempt to find catalog for an unauthenticated user.");
  }

  for (let catalog of Object.values(state.serverState.user.catalogs)) {
    if (id in catalog.albums) {
      return catalog;
    }
  }

  throw new Error("Attempt to find catalog for an unknown album.");
}

export function getAlbum(album: MapId<Album>, state?: ServerStoreState): Album | undefined {
  if (typeof album === "string") {
    return getCatalogForAlbum(album, state).albums[album];
  } else {
    return album;
  }
}

export function albumChildren(album: MapId<Album>, catalog?: Catalog): Album[] {
  let parent = intoId(album);
  catalog = catalog ? catalog : getCatalogForAlbum(album);
  return nameSorted(Object.values(catalog.albums).filter((a: Album) => a.parent == parent));
}

export function isAncestor(maybeAncestor: MapId<Album>, album: MapId<Album>): boolean {
  let ancestor = intoId(maybeAncestor);
  let kid = getAlbum(album);
  if (!kid || !kid.parent) {
    return false;
  }

  if (kid.parent === ancestor) {
    return true;
  }

  let catalog;
  try {
    catalog = getCatalogForAlbum(album);
  } catch {
    return false;
  }

  if (!(ancestor in catalog.albums)) {
    return false;
  }

  while(kid && kid.parent) {
    kid = catalog.albums[kid.parent];
    if (kid && kid.parent === ancestor) {
      return true;
    }
  }

  return false;
}

export default store;
