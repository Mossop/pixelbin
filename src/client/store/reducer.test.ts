import { enableMapSet } from "immer";

import { Album } from "../api/highlevel";
import { DialogType } from "../dialogs/types";
import { PageType } from "../pages/types";
import { mockStoreState, expect, mockServerState, mapOf, fixedState } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

beforeAll(() => {
  enableMapSet();
});

test("Navigation", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  });

  let action = actions.pushUIState({
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

test("closeDialog", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.Login,
      },
    },
  });

  let action = actions.closeDialog();

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
      lastLogin: "2020-07-02T11:30:42Z",
      email: "dtownsend@oxymoronical.com",
      administrator: false,
      fullname: "Dave Townsend",
      storage: mapOf({}),
      verified: true,
    },
    ...fixedState,
  });
});
