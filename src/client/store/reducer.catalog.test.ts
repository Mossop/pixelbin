import { enableMapSet } from "immer";

import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import { mockStoreState, expect, mapOf } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

beforeAll(() => {
  enableMapSet();
});

test("showCatalogCreateOverlay", (): void => {
  let state = mockStoreState();

  expect(state.ui).toEqual({
    page: {
      type: PageType.Index,
    },
  });

  let action = actions.showCatalogCreateOverlay();
  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Index,
    },
    overlay: {
      type: OverlayType.CreateCatalog,
    },
  });
});

test("storageCreated", (): void => {
  let state = mockStoreState();

  expect(state.serverState.user).toEqual({
    catalogs: mapOf({}),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({}),
    verified: true,
  });

  let action = actions.storageCreated({
    id: "store465",
    name: "My store",
    endpoint: null,
    publicUrl: null,
    bucket: "my bucket",
    region: "somewhere-001",
    path: null,
  });

  let newState = reducer(state, action);

  expect(newState.serverState.user).toEqual({
    catalogs: mapOf({}),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      store465: {
        id: "store465",
        name: "My store",
        endpoint: null,
        publicUrl: null,
        bucket: "my bucket",
        region: "somewhere-001",
        path: null,
      },
    }),
    verified: true,
  });
});

test("catalogCreated", (): void => {
  let state = mockStoreState();

  expect(state.serverState.user).toEqual({
    catalogs: mapOf({}),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({}),
    verified: true,
  });

  expect(state.ui).toEqual({
    page: {
      type: PageType.Index,
    },
  });

  let action = actions.catalogCreated({
    id: "cat456",
    storage: "store456",
    name: "My catalog",
    tags: mapOf({}),
    albums: mapOf({}),
    people: mapOf({}),
    searches: mapOf({}),
  });

  let newState = reducer(state, action);

  expect(newState.serverState.user).toEqual({
    catalogs: mapOf({
      cat456: {
        id: "cat456",
        storage: "store456",
        name: "My catalog",
        tags: mapOf({}),
        albums: mapOf({}),
        people: mapOf({}),
        searches: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({}),
    verified: true,
  });

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Catalog,
      catalog: expect.toBeRef("cat456"),
    },
  });
});