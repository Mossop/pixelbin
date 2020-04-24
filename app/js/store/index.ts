import { Deed } from "deeds/immer";
import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { PageType } from "../pages";
import { AsyncDispatchListener } from "./dispatch";
import reducer from "./reducer";
import { StoreState } from "./types";

export * from "./types";

export type StoreType = Store<StoreState, Deed>;

interface BuildResult {
  asyncDispatchListener: AsyncDispatchListener;
  store: StoreType;
}

function buildStore(): BuildResult {
  let initialState: StoreState = {
    serverState: { user: null },
    settings: {
      thumbnailSize: 150,
    },
    ui: {
      page: {
        type: PageType.Index,
      },
    },
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
