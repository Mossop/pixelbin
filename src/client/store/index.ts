import { Deed } from "deeds/immer";
import { enableMapSet } from "immer";
import { useStore as useReduxStore, useSelector as useReduxSelector } from "react-redux";
import { createStore } from "redux";

import { PageType } from "../pages/types";
import { provideService } from "../services";
import { AsyncDispatchListener } from "./dispatch";
import reducer from "./reducer";
import { StoreState, StoreType } from "./types";

export function buildStore(): void {
  enableMapSet();

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
    mediaList: null,
  };

  let asyncDispatchListener: AsyncDispatchListener | null = null;

  let store = createStore(
    (state: StoreState | undefined, action: Deed): StoreState => {
      if (asyncDispatchListener) {
        asyncDispatchListener.seenAction(action);
      }

      return reducer(state, action);
    },
    initialState,
    // @ts-ignore: Redux devtools.
    window.__REDUX_DEVTOOLS_EXTENSION__?.(),
  );

  provideService("store", store);
}

export const useStore = useReduxStore as () => StoreType;
export const useSelector = useReduxSelector as <R>(
  selector: (state: StoreState) => R,
  equalityFn?: (left: R, right: R) => boolean
) => R;
