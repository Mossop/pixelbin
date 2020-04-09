import { Deed } from "deeds/immer";
import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { ServerDataDecoder } from "../api/types";
import { decode } from "../utils/decoders";
import { addListener, HistoryState } from "../utils/history";
import { getState, intoUIState } from "../utils/navigation";
import actions from "./actions";
import { AsyncDispatchListener } from "./dispatch";
import reducer from "./reducer";
import { StoreState, ServerState } from "./types";

export type StoreType = Store<StoreState, Deed> & {
  asyncDispatch: (action: Deed) => Promise<StoreState>;
};

function buildStore(): StoreType {
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

  let AsyncDispatch: AsyncDispatchListener | undefined;

  let store = createStore(
    (state: StoreState | undefined, action: Deed): StoreState => {
      if (AsyncDispatch) {
        AsyncDispatch.seenAction(action);
      }
      return reducer(state, action);
    },
    initialState,
    applyMiddleware(...middlewares),
  );

  addListener((historyState: HistoryState): void => {
    let uiState = intoUIState(historyState, store.getState().serverState);
    store.dispatch(actions.historyStateChanged(uiState));
  });

  AsyncDispatch = new AsyncDispatchListener(store);

  return Object.assign({
    asyncDispatch: (action: Deed): Promise<StoreState> => {
      return AsyncDispatch ? AsyncDispatch.dispatch(action) : Promise.resolve(store.getState());
    },
  }, store);
}

const store = buildStore();

export const { asyncDispatch } = store;

export default store;