import { enableMapSet } from "immer";
import { useStore as useReduxStore, useSelector as useReduxSelector } from "react-redux";
import { createStore } from "redux";

import { PageType } from "../pages/types";
import { provideService } from "../services";
import reducer from "./reducer";
import type { StoreState, StoreType } from "./types";

export function buildStore(): void {
  enableMapSet();

  let initialState: StoreState = {
    serverState: { user: null },
    settings: {
      thumbnailSize: 150,
    },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  };

  let store = createStore(
    reducer,
    initialState,
    // @ts-ignore
    window.__REDUX_DEVTOOLS_EXTENSION__?.(),
  );

  provideService("store", store);
}

export const useStore = useReduxStore as () => StoreType;
export const useSelector = useReduxSelector as <R>(
  selector: (state: StoreState) => R,
  equalityFn?: (left: R, right: R) => boolean
) => R;
