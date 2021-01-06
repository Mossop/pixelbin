import { enableMapSet } from "immer";
import { useStore as useReduxStore, useSelector as useReduxSelector } from "react-redux";
import { createStore } from "redux";

import type { ServerState, UserState } from "../api/types";
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
      seenTouchMessage: false,
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

export const useSelector = useReduxSelector as <R>(
  selector: (state: StoreState) => R,
  equalityFn?: (left: R, right: R) => boolean
) => R;

function userStateSelector(state: StoreState): UserState | null {
  return state.serverState.user;
}

export function useUserState(): UserState | null {
  return useSelector(userStateSelector);
}

function serverStateSelector(state: StoreState): ServerState {
  return state.serverState;
}

export function useServerState(): ServerState {
  return useSelector(serverStateSelector);
}
