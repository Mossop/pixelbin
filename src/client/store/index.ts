import { enableMapSet } from "immer";
import { useCallback } from "react";
import { useStore as useReduxStore, useSelector as useReduxSelector } from "react-redux";
import { createStore } from "redux";

import { initialServerState } from "../context";
import { provideService } from "../services";
import { getUIState } from "../utils/navigation";
import reducer from "./reducer";
import type { StoreState, StoreType } from "./types";

export function buildStore(): StoreType {
  enableMapSet();

  let serverState = initialServerState();
  let initialState: StoreState = {
    serverState,
    settings: {
      thumbnailSize: 150,
    },
    ui: getUIState(serverState),
  };

  let store = createStore(
    reducer,
    initialState,
    // @ts-ignore
    window.__REDUX_DEVTOOLS_EXTENSION__?.(),
  );

  provideService("store", store);
  return store;
}

export const useStore = useReduxStore as () => StoreType;

export function useSelector<R>(
  selector: (state: StoreState) => R,
  params: unknown[] = [],
): R {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useReduxSelector(useCallback(selector, params));
}
