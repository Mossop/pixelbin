import { Deed } from "deeds/immer";

import { Album } from "../../js/api/highlevel";
import { OverlayType } from "../../js/overlays";
import { PageType } from "../../js/pages/types";
import { StoreType, StoreState } from "../../js/store";
import actions from "../../js/store/actions";
import reducer from "../../js/store/reducer";
import {
  addListener,
  getState,
  pushState,
  replaceState,
  HistoryState,
} from "../../js/utils/history";
import { watchStore } from "../../js/utils/navigation";
import { mockStore, expect, mockedFunction } from "../helpers";

/* eslint-disable */
jest.mock("../../js/utils/history", () => {
  let actual = jest.requireActual("../../js/utils/history");
  return {
    ...actual,
    addListener: jest.fn(),
    getState: jest.fn(),
    pushState: jest.fn(),
    replaceState: jest.fn(),
  };
});
/* eslint-enable */

const mockedAddListener = mockedFunction(addListener);
const mockedGetState = mockedFunction(getState);
const mockedPushState = mockedFunction(pushState);
const mockedReplaceState = mockedFunction(replaceState);

test("Navigate", (): void => {
  let state = mockStore({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  });

  let action = actions.navigate({
    page: {
      type: PageType.Album,
      album: Album.ref("testalbum"),
    },
    overlay: {
      type: OverlayType.Upload,
    },
  });

  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testalbum"),
    },
    overlay: {
      type: OverlayType.Upload,
    },
  });
});

test("History navigations", (): void => {
  let mockStoreState: StoreState = mockStore({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  });

  let mockedStore = {
    dispatch: jest.fn<void, [Deed]>(),
    subscribe: jest.fn<void, [() => void]>(),
    getState: (): StoreState => mockStoreState,
  };

  mockedGetState.mockImplementationOnce((): HistoryState => ({ path: "/" }));
  watchStore(mockedStore as unknown as StoreType);

  expect(mockedStore.dispatch).toHaveBeenCalledWith({
    type: "updateUIState",
    payload: [{
      page: {
        type: PageType.Index,
      },
    }],
  });
  mockStoreState = reducer(mockStoreState, mockedStore.dispatch.mock.calls[0][0]);
  mockedStore.dispatch.mockClear();

  expect(mockedStore.subscribe).toHaveBeenCalledTimes(1);
  expect(mockedStore.subscribe.mock.calls[0]).toHaveLength(1);

  let storeSubscriber = mockedStore.subscribe.mock.calls[0][0];

  expect(mockedPushState).toHaveBeenCalledTimes(0);
  expect(mockedReplaceState).toHaveBeenCalledTimes(0);
  expect(mockedAddListener).toHaveBeenCalledTimes(1);

  let historyListener = mockedAddListener.mock.calls[0][0];

  // Re-sending the current state should do nothing...
  storeSubscriber();

  expect(mockedStore.dispatch).toHaveBeenCalledTimes(0);
  expect(mockedPushState).toHaveBeenCalledTimes(0);
  expect(mockedReplaceState).toHaveBeenCalledTimes(0);

  mockStoreState = mockStore({
    ui: {
      page: {
        type: PageType.User,
      },
    },
  });

  // Send out the new state.
  storeSubscriber();

  expect(mockedStore.dispatch).toHaveBeenCalledTimes(0);
  expect(mockedReplaceState).toHaveBeenCalledTimes(0);

  expect(mockedPushState).toHaveBeenCalledWith({
    path: "/user",
  });
  mockedPushState.mockClear();

  // Simulate a navigation.
  historyListener({ path: "/foobar" });

  expect(mockedPushState).toHaveBeenCalledTimes(0);
  expect(mockedReplaceState).toHaveBeenCalledTimes(0);

  expect(mockedStore.dispatch).toHaveBeenCalledWith({
    type: "updateUIState",
    payload: [{
      page: {
        type: PageType.NotFound,
        history: {
          path: "/foobar",
        },
      },
    }],
  });
  mockStoreState = reducer(mockStoreState, mockedStore.dispatch.mock.calls[0][0]);
  mockedStore.dispatch.mockClear();

  // Re-sending the current state should do nothing...
  storeSubscriber();

  expect(mockedStore.dispatch).toHaveBeenCalledTimes(0);
  expect(mockedPushState).toHaveBeenCalledTimes(0);
  expect(mockedReplaceState).toHaveBeenCalledTimes(0);

  mockStoreState = mockStore({
    ui: {
      page: {
        type: PageType.NotFound,
        history: {
          path: "/foobar",
          state: { any: 5 },
        },
      },
    },
  });

  // A change that doesn't impact the visible url will cause a replace state.
  storeSubscriber();

  expect(mockedStore.dispatch).toHaveBeenCalledTimes(0);
  expect(mockedPushState).toHaveBeenCalledTimes(0);

  expect(mockedReplaceState).toHaveBeenCalledWith({
    path: "/foobar",
    state: { any: 5 },
  });
});
