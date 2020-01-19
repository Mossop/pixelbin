import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { ServerDataDecoder, ServerData } from "../api/types";
import { decode } from "../utils/decoders";
import { ReduxHistory, createReduxHistory } from "../utils/history";
import { ActionType } from "./actions";
import { AsyncDispatchListener } from "./dispatch";
import reducer from "./reducer";
import { StoreState } from "./types";

export type StoreType = Store<StoreState, ActionType> & {
  asyncDispatch: (action: ActionType) => Promise<StoreState>;
};

function buildStore(): StoreType {
  let initialServerState: ServerData = { user: null };
  let stateElement = document.getElementById("initial-state");
  if (stateElement && stateElement.textContent) {
    try {
      initialServerState = decode(ServerDataDecoder, JSON.parse(stateElement.textContent));
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

  AsyncDispatch = new AsyncDispatchListener(store);

  return Object.assign({
    asyncDispatch: (action: ActionType): Promise<StoreState> => {
      return AsyncDispatch ? AsyncDispatch.dispatch(action) : Promise.resolve(store.getState());
    },
  }, store);
}

const store = buildStore();

export const history: ReduxHistory = createReduxHistory(store);
export const asyncDispatch = store.asyncDispatch;

export default store;
