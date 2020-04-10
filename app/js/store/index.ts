import { Deed } from "deeds/immer";
import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { ServerDataDecoder } from "../api/types";
import { decode } from "../utils/decoders";
import { getState } from "../utils/navigation";
import { AsyncDispatchListener } from "./dispatch";
import reducer from "./reducer";
import { StoreState, ServerState } from "./types";

export type StoreType = Store<StoreState, Deed>;

interface BuildResult {
  asyncDispatchListener: AsyncDispatchListener;
  store: StoreType;
}

function buildStore(): BuildResult {
  let serverState: ServerState = { user: null };
  let stateElement = document.getElementById("initial-state");
  if (stateElement?.textContent) {
    try {
      serverState = decode(ServerDataDecoder, JSON.parse(stateElement.textContent));
    } catch (e) {
      console.error(e);
    }
  }

  let initialState: StoreState = {
    serverState,
    settings: {
      thumbnailSize: 150,
    },
    ui: getState(serverState),
    stateId: 0,
  };

  const middlewares: Middleware[] = [];

  if (process.env.NODE_ENV === "development") {
    middlewares.push(createLogger());
  }

  let asyncDispatchListener: AsyncDispatchListener | null = null;

  let store = createStore(
    (state: StoreState | undefined, action: Deed): StoreState => {
      if (asyncDispatchListener) {
        asyncDispatchListener.seenAction(action);
      }

      return reducer(state, action);
    },
    initialState,
    applyMiddleware(...middlewares),
  );

  asyncDispatchListener = new AsyncDispatchListener(store);

  return { asyncDispatchListener, store };
}

const { asyncDispatchListener, store } = buildStore();

export const asyncDispatch = (action: Deed): Promise<StoreState> => {
  return asyncDispatchListener.dispatch(action);
};

export default store;
