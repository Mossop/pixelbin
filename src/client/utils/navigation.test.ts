import { castDraft } from "immer";

import { Join } from "../../model";
import { mockedFunction } from "../../test-helpers";
import type { Obj } from "../../utils/utility";
import { Catalog, Album, SavedSearch } from "../api/highlevel";
import type { ServerState } from "../api/types";
import { DialogType } from "../dialogs/types";
import { PageType } from "../pages/types";
import reducer from "../store/reducer";
import type { StoreType } from "../store/types";
import {
  expect,
  mockServerState,
  mapOf,
  mockStoreState,
  mockStore,
  fixedState,
} from "../test-helpers";
import type { HistoryState } from "./history";
import { addListener, getState, pushState, replaceState } from "./history";
import { intoUIState, fromUIState, stateURLMatches, watchStore } from "./navigation";

/* eslint-disable */
jest.mock("../utils/history", () => {
  let actual = jest.requireActual("../utils/history");
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

function state(path: string, params?: Obj): HistoryState {
  return {
    path,
    params: params ? new Map(Object.entries(params)) : undefined,
  };
}

const LoggedOut: ServerState = {
  user: null,
  ...fixedState,
};

const LoggedIn = mockServerState([{
  id: "testcatalog",
  name: "Test Catalog 1",

  albums: [{
    id: "testalbum",
    name: "Test Album 1",
  }],
  searches: [{
    id: "testsearch",
    name: "Saved Search",
  }],
}]);

test("index page", (): void => {
  expect(intoUIState(state("/"), LoggedOut)).toEqual({
    page: {
      type: PageType.Root,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Root,
    },
  })).toEqual(state("/"));
});

test("not found", (): void => {
  expect(intoUIState(state("/foo/bar"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/foo/bar"),
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.NotFound,
      history: state("/foo/bar"),
    },
  })).toEqual(state("/foo/bar"));
});

test("catalog page", (): void => {
  expect(intoUIState(state("/catalog/testcatalog"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/catalog/testcatalog"),
    },
  });

  expect(intoUIState(state("/catalog/testcatalog"), LoggedIn)).toEqual({
    page: {
      type: PageType.Catalog,
      catalog: expect.toBeRef("testcatalog"),
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Catalog,
      catalog: Catalog.ref("testcatalog"),
    },
  })).toEqual(state("/catalog/testcatalog"));
});

test("media", (): void => {
  expect(intoUIState(state("/album/testalbum/media/testmedia"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/album/testalbum/media/testmedia"),
    },
  });

  expect(intoUIState(state("/album/testalbum/media/testmedia"), LoggedIn)).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testalbum"),
      selectedMedia: "testmedia",
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Album,
      album: Album.ref("testalbum"),
      selectedMedia: "testmedia",
    },
  })).toEqual(state("/album/testalbum/media/testmedia"));

  expect(intoUIState(state("/catalog/testcatalog/media/testmedia"), LoggedIn)).toEqual({
    page: {
      type: PageType.Catalog,
      catalog: expect.toBeRef("testcatalog"),
      selectedMedia: "testmedia",
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Catalog,
      catalog: Catalog.ref("testcatalog"),
      selectedMedia: "testmedia",
    },
  })).toEqual(state("/catalog/testcatalog/media/testmedia"));
});

test("search page", (): void => {
  expect(intoUIState(state("/catalog/testcatalog/search"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/catalog/testcatalog/search"),
    },
  });

  expect(intoUIState(state("/catalog/testcatalog/search"), LoggedIn)).toEqual({
    page: {
      type: PageType.Search,
      catalog: expect.toBeRef("testcatalog"),
      query: {
        invert: false,
        type: "compound",
        join: Join.And,
        queries: [],
      },
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Search,
      catalog: Catalog.ref("testcatalog"),
      query: {
        invert: false,
        type: "compound",
        join: Join.And,
        queries: [],
      },
    },
  })).toEqual(state("/catalog/testcatalog/search"));
});

test("saved search page", (): void => {
  expect(intoUIState(state("/search/testsearch"), LoggedOut)).toEqual({
    page: {
      type: PageType.SharedSearch,
      search: "testsearch",
    },
  });

  expect(intoUIState(state("/search/testsearch"), LoggedIn)).toEqual({
    page: {
      type: PageType.SavedSearch,
      search: expect.toBeRef("testsearch"),
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.SharedSearch,
      search: "bar",
      selectedMedia: "baz",
    },
  })).toEqual(state("/search/bar/media/baz"));

  expect(fromUIState({
    page: {
      type: PageType.SharedSearch,
      search: "bar",
    },
  })).toEqual(state("/search/bar"));

  expect(fromUIState({
    page: {
      type: PageType.SavedSearch,
      search: SavedSearch.ref("bar"),
      selectedMedia: "baz",
    },
  })).toEqual(state("/search/bar/media/baz"));

  expect(fromUIState({
    page: {
      type: PageType.SavedSearch,
      search: SavedSearch.ref("bar"),
    },
  })).toEqual(state("/search/bar"));
});

test("album page", (): void => {
  expect(intoUIState(state("/album/testalbum"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/album/testalbum"),
    },
  });

  expect(intoUIState(state("/album/testalbum"), LoggedIn)).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testalbum"),
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Album,
      album: Album.ref("testalbum"),
    },
  })).toEqual(state("/album/testalbum"));
});

test("user page", (): void => {
  expect(intoUIState(state("/user"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/user"),
    },
  });

  expect(intoUIState(state("/user"), LoggedIn)).toEqual({
    page: {
      type: PageType.User,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.User,
    },
  })).toEqual(state("/user"));
});

test("login dialog", (): void => {
  expect(intoUIState(state("/login"), LoggedOut)).toEqual({
    page: {
      type: PageType.Root,
    },
    dialog: {
      type: DialogType.Login,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Root,
    },
    dialog: {
      type: DialogType.Login,
    },
  })).toEqual(state("/login"));

  expect(intoUIState(state("/login", { path: "/user" }), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/user"),
    },
    dialog: {
      type: DialogType.Login,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.NotFound,
      history: state("/user"),
    },
    dialog: {
      type: DialogType.Login,
    },
  })).toEqual(state("/login", { path: "/user" }));

  expect(intoUIState(state("/login", { path: "/user" }), LoggedIn)).toEqual({
    page: {
      type: PageType.User,
    },
    dialog: {
      type: DialogType.Login,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.User,
    },
    dialog: {
      type: DialogType.Login,
    },
  })).toEqual(state("/login", { path: "/user" }));
});

test("stateURLMatches.", (): void => {
  expect(stateURLMatches({
    path: "/foo",
  }, {
    path: "/foo",
  })).toBeTruthy();

  expect(stateURLMatches({
    path: "/foo",
    hash: "bar",
  }, {
    path: "/foo",
    hash: "bar",
  })).toBeTruthy();

  expect(stateURLMatches({
    path: "/foo",
  }, {
    path: "/foo",
    hash: "bar",
  })).toBeFalsy();

  expect(stateURLMatches({
    path: "/foo",
    hash: "bar",
  }, {
    path: "/foo",
  })).toBeFalsy();

  expect(stateURLMatches({
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
  }, {
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
  })).toBeTruthy();

  expect(stateURLMatches({
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  }, {
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  })).toBeTruthy();

  expect(stateURLMatches({
    path: "/foo",
    hash: "5",
  }, {
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  })).toBeFalsy();

  expect(stateURLMatches({
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  }, {
    path: "/foo",
    hash: "5",
  })).toBeFalsy();

  expect(stateURLMatches({
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
      d: "foo",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  }, {
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  })).toBeFalsy();

  expect(stateURLMatches({
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  }, {
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
      d: "foo",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  })).toBeFalsy();

  expect(stateURLMatches({
    path: "/foo",
    params: mapOf({
      a: "5",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  }, {
    path: "/foo",
    params: mapOf({
      a: "6",
      b: "hello",
      c: "none",
    }) as ReadonlyMap<string, string>,
    hash: "5",
  })).toBeFalsy();
});

test("History navigations", (): void => {
  let mockedStore = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  }));

  mockedGetState.mockImplementationOnce((): HistoryState => ({ path: "/" }));
  watchStore(mockedStore as unknown as StoreType);

  expect(mockedStore.dispatch).toHaveBeenCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Root,
      },
    }],
  });
  mockedStore.state = castDraft(reducer(mockedStore.state, mockedStore.dispatch.mock.calls[0][0]));
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

  mockedStore.state = mockStoreState({
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
    type: "navigate",
    payload: [{
      page: {
        type: PageType.NotFound,
        history: {
          path: "/foobar",
        },
      },
    }],
  });
  mockedStore.state = castDraft(reducer(mockedStore.state, mockedStore.dispatch.mock.calls[0][0]));
  mockedStore.dispatch.mockClear();

  // Re-sending the current state should do nothing...
  storeSubscriber();

  expect(mockedStore.dispatch).toHaveBeenCalledTimes(0);
  expect(mockedPushState).toHaveBeenCalledTimes(0);
  expect(mockedReplaceState).toHaveBeenCalledTimes(0);

  mockedStore.state = mockStoreState({
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
