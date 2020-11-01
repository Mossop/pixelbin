import { enableMapSet } from "immer";

import { Operator } from "../../model";
import { Catalog } from "../api/highlevel";
import { PageType } from "../pages/types";
import { mockStoreState, expect, mapOf, mockServerState } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

beforeAll(() => {
  enableMapSet();
});

test("storageCreated", (): void => {
  let state = mockStoreState();

  expect(state.serverState.user).toEqual({
    catalogs: mapOf({}),
    created: "2020-04-05T12:34:45Z",
    lastLogin: "2020-07-02T11:30:42Z",
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
    lastLogin: "2020-07-02T11:30:42Z",
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
    lastLogin: "2020-07-02T11:30:42Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({}),
    verified: true,
  });

  expect(state.ui).toEqual({
    page: {
      type: PageType.Root,
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
    lastLogin: "2020-07-02T11:30:42Z",
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

test("catalogEdited", (): void => {
  let state = mockStoreState({
    serverState: mockServerState([{
      id: "c1",
      name: "initial",
      storage: "s1",
      albums: [{
        id: "a1",
        name: "album 1",
      }, {
        id: "a2",
        name: "album 2",
      }],
    }, {
      id: "c2",
      name: "other",
      storage: "s1",
    }]),
  });

  expect(state.serverState.user).toEqual({
    catalogs: mapOf({
      c1: {
        id: "c1",
        name: "initial",
        storage: "s1",
        albums: mapOf({
          a1: {
            id: "a1",
            name: "album 1",
            catalog: expect.toBeRef("c1"),
            parent: null,
          },
          a2: {
            id: "a2",
            name: "album 2",
            catalog: expect.toBeRef("c1"),
            parent: null,
          },
        }),
        tags: mapOf({}),
        people: mapOf({}),
        searches: mapOf({}),
      },
      c2: {
        albums: mapOf({}),

        id: "c2",
        name: "other",
        people: mapOf({}),
        searches: mapOf({}),
        storage: "s1",
        tags: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    lastLogin: "2020-07-02T11:30:42Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      s1: {
        bucket: "test-bucket",
        endpoint: null,
        id: "s1",
        name: "Test store",
        path: null,
        publicUrl: null,
        region: "test-region-001",
      },
    }),
    verified: true,
  });

  let action = actions.catalogEdited({
    id: "c1",
    storage: "s1",
    name: "My new name",
  });

  let newState = reducer(state, action);

  expect(newState.serverState.user).toEqual({
    catalogs: mapOf({
      c1: {
        id: "c1",
        name: "My new name",
        storage: "s1",
        albums: mapOf({
          a1: {
            id: "a1",
            name: "album 1",
            catalog: expect.toBeRef("c1"),
            parent: null,
          },
          a2: {
            id: "a2",
            name: "album 2",
            catalog: expect.toBeRef("c1"),
            parent: null,
          },
        }),
        tags: mapOf({}),
        people: mapOf({}),
        searches: mapOf({}),
      },
      c2: {
        albums: mapOf({}),

        id: "c2",
        name: "other",
        people: mapOf({}),
        searches: mapOf({}),
        storage: "s1",
        tags: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    lastLogin: "2020-07-02T11:30:42Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      s1: {
        bucket: "test-bucket",
        endpoint: null,
        id: "s1",
        name: "Test store",
        path: null,
        publicUrl: null,
        region: "test-region-001",
      },
    }),
    verified: true,
  });
});

test("searchSaved", () => {
  let state = mockStoreState({
    serverState: mockServerState([{
      id: "c1",
      name: "initial",
      storage: "s1",
      albums: [{
        id: "a1",
        name: "album 1",
      }, {
        id: "a2",
        name: "album 2",
      }],
    }, {
      id: "c2",
      name: "other",
      storage: "s1",
    }]),
  });

  expect(state.serverState.user).toEqual({
    catalogs: mapOf({
      c1: {
        id: "c1",
        name: "initial",
        storage: "s1",
        albums: mapOf({
          a1: {
            id: "a1",
            name: "album 1",
            catalog: expect.toBeRef("c1"),
            parent: null,
          },
          a2: {
            id: "a2",
            name: "album 2",
            catalog: expect.toBeRef("c1"),
            parent: null,
          },
        }),
        tags: mapOf({}),
        people: mapOf({}),
        searches: mapOf({}),
      },
      c2: {
        id: "c2",
        name: "other",
        albums: mapOf({}),
        people: mapOf({}),
        searches: mapOf({}),
        storage: "s1",
        tags: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    lastLogin: "2020-07-02T11:30:42Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      s1: {
        bucket: "test-bucket",
        endpoint: null,
        id: "s1",
        name: "Test store",
        path: null,
        publicUrl: null,
        region: "test-region-001",
      },
    }),
    verified: true,
  });

  let action = actions.searchSaved({
    id: "s1",
    catalog: Catalog.ref("c2"),
    name: "My new search",
    shared: true,
    query: {
      type: "field",
      invert: false,
      field: "title",
      modifier: null,
      operator: Operator.Equal,
      value: "foo",
    },
  });

  let newState = reducer(state, action);

  expect(newState.serverState.user).toEqual({
    catalogs: mapOf({
      c1: {
        id: "c1",
        name: "initial",
        storage: "s1",
        albums: mapOf({
          a1: {
            id: "a1",
            name: "album 1",
            catalog: expect.toBeRef("c1"),
            parent: null,
          },
          a2: {
            id: "a2",
            name: "album 2",
            catalog: expect.toBeRef("c1"),
            parent: null,
          },
        }),
        tags: mapOf({}),
        people: mapOf({}),
        searches: mapOf({}),
      },
      c2: {
        id: "c2",
        name: "other",
        storage: "s1",
        albums: mapOf({}),
        people: mapOf({}),
        tags: mapOf({}),
        searches: mapOf({
          s1: {
            id: "s1",
            catalog: Catalog.ref("c2"),
            name: "My new search",
            shared: true,
            query: {
              type: "field",
              invert: false,
              field: "title",
              modifier: null,
              operator: Operator.Equal,
              value: "foo",
            },
          },
        }),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    lastLogin: "2020-07-02T11:30:42Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      s1: {
        bucket: "test-bucket",
        endpoint: null,
        id: "s1",
        name: "Test store",
        path: null,
        publicUrl: null,
        region: "test-region-001",
      },
    }),
    verified: true,
  });

  expect(newState.ui).toEqual({
    page: {
      type: PageType.SavedSearch,
      searchId: "s1",
    },
  });
});
