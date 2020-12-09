import type { Deed } from "deeds/immer";
import type { Draft } from "immer";
import { enableMapSet } from "immer";

import type { ServerState } from "../api/types";
import { DialogType } from "../dialogs/types";
import { PageType } from "../pages/types";
import { mockStoreState, mockServerState, expect, fixedState } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";
import type { UIState } from "./types";

beforeAll(() => {
  enableMapSet();
});

test("Logging in with a catalog", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
  });

  let newServerState = mockServerState([{
    id: "testcatalog",
    name: "Test catalog",
  }]);

  let action = actions.completeLogin(newServerState);
  let newState = reducer(state, action);

  let expectedUI = {
    page: {
      type: PageType.Catalog,
      catalog: expect.toBeRef("testcatalog"),
    },
  };

  expect(newState.serverState).toEqual(newServerState);
  expect(newState.ui).toEqual(expectedUI);
});

test("Logging in with multiple catalogs", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
  });

  let newServerState = mockServerState([{
    id: "testcatalog1",
    name: "Test catalog",
  }, {
    id: "testcatalog2",
    name: "Another test catalog",
  }]);

  let action = actions.completeLogin(newServerState);
  let newState = reducer(state, action);

  let expectedUI = {
    page: {
      type: PageType.Catalog,
      catalog: expect.toBeRef("testcatalog2"),
    },
  };

  expect(newState.serverState).toEqual(newServerState);
  expect(newState.ui).toEqual(expectedUI);
});

test("Logging in with no catalogs shows catalog create", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
  });

  let newServerState: ServerState = {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      administrator: false,
      created: "2020-09-02T07:56:00Z",
      lastLogin: "2020-09-04T07:56:00Z",
      verified: true,
      storage: new Map(),
      catalogs: new Map(),
    },
    ...fixedState,
  };

  let action = actions.completeLogin(newServerState);
  let newState = reducer(state, action);

  let expectedUI = {
    page: {
      type: PageType.User,
    },
    dialog: {
      type: DialogType.CatalogCreate,
    },
  };

  expect(newState.serverState).toEqual(newServerState);
  expect(newState.ui).toEqual(expectedUI);
});

test("Creating a user.", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  });

  let action: Deed = actions.completeSignup(mockServerState([]));
  let newState = reducer(state, action);

  let expectedUI: Draft<UIState> = {
    page: {
      type: PageType.User,
    },
    dialog: {
      type: DialogType.CatalogCreate,
    },
  };

  expect(newState.ui).toEqual(expectedUI);

  action = actions.completeLogout(mockServerState([]));
  newState = reducer(newState, action);

  expectedUI = {
    page: {
      type: PageType.Root,
    },
  };

  expect(newState.ui).toEqual(expectedUI);
});
