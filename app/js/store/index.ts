import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { ServerDataDecoder } from "../api/types";
import { decode } from "../utils/decoders";
import { addListener, HistoryState } from "../utils/history";
import { getState, intoUIState } from "../utils/navigation";
import { ActionType, historyStateChangedAction } from "./actions";
import { AsyncDispatchListener } from "./dispatch";
import reducer from "./reducer";
import { StoreState, ServerState } from "./types";

export type StoreType = Store<StoreState, ActionType> & {
  asyncDispatch: (action: ActionType) => Promise<StoreState>;
};

function buildStore(): StoreType {
  let serverState: ServerState = { user: null };
  let stateElement = document.getElementById("initial-state");
  if (stateElement && stateElement.textContent) {
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
  console.log("Initial state", initialState);

  const middlewares: Middleware[] = [];

  if (process.env.NODE_ENV === "development") {
    middlewares.push(createLogger());
  }

  let AsyncDispatch: AsyncDispatchListener | undefined;

  let store = createStore(
    (state: StoreState, action: ActionType): StoreState => {
      if (AsyncDispatch) {
        AsyncDispatch.seenAction(action);
      }
      return reducer(state, action);
    },
    initialState,
    applyMiddleware(...middlewares),
  );

  addListener((historyState: HistoryState) => {
    let uiState = intoUIState(historyState, store.getState().serverState);
    console.log("navigation", historyState, uiState);
    store.dispatch(historyStateChangedAction(uiState));
  });

  AsyncDispatch = new AsyncDispatchListener(store);

  return Object.assign({
    asyncDispatch: (action: ActionType): Promise<StoreState> => {
      return AsyncDispatch ? AsyncDispatch.dispatch(action) : Promise.resolve(store.getState());
    },
  }, store);
}

const store = buildStore();

export const asyncDispatch = store.asyncDispatch;

export default store;
