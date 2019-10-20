import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import reducer from "./reducer";
import { StoreState } from "./types";
import { ActionType } from "./actions";
import { Catalog, ServerStateDecoder, Album, ServerState } from "../api/types";
import { decode } from "../utils/decoders";

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

  let initialState: StoreState = { serverState: initialServerState, historyState: null };

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

export function getCatalog(id: string, state?: StoreState): Catalog | undefined {
  if (!state) {
    state = store.getState();
  }

  if (!state.serverState.user) {
    return undefined;
  }

  return state.serverState.user.catalogs[id];
}

export function getCatalogForAlbum(album: string | Album, state?: StoreState): Catalog | undefined {
  if (!state) {
    state = store.getState();
  }

  let id: string;
  if (typeof album === "string") {
    id = album;
  } else {
    id = album.id;
  }

  if (!state.serverState.user) {
    return undefined;
  }

  for (let catalog of Object.values(state.serverState.user.catalogs)) {
    if (id in catalog.albums) {
      return catalog;
    }
  }

  return undefined;
}

export function getAlbum(id: string, state?: StoreState): Album | undefined {
  let catalog = getCatalogForAlbum(id, state);
  return catalog ? catalog.albums[id] : undefined;
}

export function getParent(id: string, state?: StoreState): Album | Catalog | undefined {
  let catalog = getCatalog(id, state);
  if (catalog) {
    return catalog;
  }

  return getAlbum(id, state);
}

export default store;
