import { enableMapSet } from "immer";

import { Album } from "../api/highlevel";
import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import { mockStoreState, expect, mockServerState, mapOf } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

beforeAll(() => {
  enableMapSet();
});

test("Navigate", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  });

  let action = actions.navigate({
    page: {
      type: PageType.Album,
      album: Album.ref("testalbum"),
    },
  });

  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testalbum"),
    },
  });
});

test("closeOverlay", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.Login,
      },
    },
  });

  let action = actions.closeOverlay();

  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Root,
    },
  });
});

test("updateServerState", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  });

  let action = actions.updateServerState(mockServerState([]));

  let newState = reducer(state, action);

  expect(newState.serverState).toEqual({
    user: {
      catalogs: mapOf({}),
      created: "2020-04-05T12:34:45Z",
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      storage: mapOf({}),
      verified: true,
    },
  });
});
