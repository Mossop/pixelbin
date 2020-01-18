import { applyMiddleware, createStore, Store, Middleware } from "redux";
import { createLogger } from "redux-logger";

import { ServerDataDecoder, ServerData } from "../api/types";
import { decode } from "../utils/decoders";
import { ActionType } from "./actions";
import reducer from "./reducer";
import { StoreState } from "./types";

export type StoreType = Store<StoreState, ActionType>;

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

  return createStore(
    reducer,
    initialState,
    applyMiddleware(...middlewares),
  );
}

export default buildStore();
