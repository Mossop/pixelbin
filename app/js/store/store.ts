import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import reducer from "./reducer";
import { StoreState } from "./types";
import { ActionType } from "./actions";
import { Catalog, ServerStateDecoder, Album } from "../api/types";
import { decode } from "../utils/decoders";

function buildStore(): Store<StoreState, ActionType> {
  let initialState: StoreState = { serverState: { }, historyState: null };
  let stateElement = document.getElementById("initial-state");
  if (stateElement && stateElement.textContent) {
    try {
      initialState.serverState = decode(ServerStateDecoder, JSON.parse(stateElement.textContent));
    } catch (e) {
      console.error(e);
    }
  }

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

  return state.serverState.user.catalogs.get(id);
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

  for (let catalog of state.serverState.user.catalogs.values()) {
    if (catalog.albums.has(id)) {
      return catalog;
    }
  }

  return undefined;
}

export function getAlbum(id: string, state?: StoreState): Album | undefined {
  let catalog = getCatalogForAlbum(id, state);
  return catalog ? catalog.albums.get(id) : undefined;
}

export default store;
