import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import reducer from "./reducer";
import { StoreState } from "./types";
import { ActionType } from "./actions";
import { Catalog, ServerStateDecoder } from "../api/types";
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

export default store;
