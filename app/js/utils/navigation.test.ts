import { castDraft } from "immer";

import { Catalog, Album } from "../api/highlevel";
import { ServerData } from "../api/types";
import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import reducer from "../store/reducer";
import { StoreType } from "../store/types";
import {
  expect,
  mockServerData,
  mapOf,
  mockedFunction,
  mockStoreState,
  mockStore,
} from "../test-helpers";
import { ErrorCode } from "./exception";
import { HistoryState, addListener, getState, pushState, replaceState } from "./history";
import { intoUIState, fromUIState, stateURLMatches, watchStore } from "./navigation";

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

function state(path: string, params?: {}): HistoryState {
  return {
    path,
    params: params ? new Map(Object.entries(params)) : undefined,
  };
}

const LoggedOut: ServerData = {
  user: null,
};

const LoggedIn = mockServerData([{
  id: "testcatalog",
  name: "Test Catalog 1",

  albums: [{
    id: "testalbum",
    name: "Test Album 1",
    stub: null,
  }],
}]);

test("index page", (): void => {
  expect(intoUIState(state("/"), LoggedOut)).toEqual({
    page: {
      type: PageType.Index,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Index,
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

test("login overlay", (): void => {
  expect(intoUIState(state("/login"), LoggedOut)).toEqual({
    page: {
      type: PageType.Index,
    },
    overlay: {
      type: OverlayType.Login,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Index,
    },
    overlay: {
      type: OverlayType.Login,
    },
  })).toEqual(state("/login"));

  expect(intoUIState(state("/login", { path: "/user" }), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/user"),
    },
    overlay: {
      type: OverlayType.Login,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.NotFound,
      history: state("/user"),
    },
    overlay: {
      type: OverlayType.Login,
    },
  })).toEqual(state("/login", { path: "/user" }));

  expect(intoUIState(state("/login", { path: "/user" }), LoggedIn)).toEqual({
    page: {
      type: PageType.User,
    },
    overlay: {
      type: OverlayType.Login,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.User,
    },
    overlay: {
      type: OverlayType.Login,
    },
  })).toEqual(state("/login", { path: "/user" }));
});

test("upload overlay", (): void => {
  expect(intoUIState(state("/upload"), LoggedOut)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/upload"),
    },
  });

  expect(intoUIState(state("/upload"), LoggedIn)).toEqual({
    page: {
      type: PageType.User,
    },
    overlay: {
      type: OverlayType.Upload,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.User,
    },
    overlay: {
      type: OverlayType.Upload,
    },
  })).toEqual(state("/upload"));

  expect(intoUIState(state("/upload", { catalog: "testcatalog" }), LoggedIn)).toEqual({
    page: {
      type: PageType.Catalog,
      catalog: expect.toBeRef("testcatalog"),
    },
    overlay: {
      type: OverlayType.Upload,
    },
  });

  expect(intoUIState(state("/upload", { catalog: "badcatalog" }), LoggedIn)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/upload", { catalog: "badcatalog" }),
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Catalog,
      catalog: Catalog.ref("testcatalog"),
    },
    overlay: {
      type: OverlayType.Upload,
    },
  })).toEqual(state("/upload", { catalog: "testcatalog" }));

  expect(intoUIState(state("/upload", { album: "badalbum" }), LoggedIn)).toEqual({
    page: {
      type: PageType.NotFound,
      history: state("/upload", { album: "badalbum" }),
    },
  });

  expect(intoUIState(state("/upload", { album: "testalbum" }), LoggedIn)).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testalbum"),
    },
    overlay: {
      type: OverlayType.Upload,
    },
  });

  expect(fromUIState({
    page: {
      type: PageType.Album,
      album: Album.ref("testalbum"),
    },
    overlay: {
      type: OverlayType.Upload,
    },
  })).toEqual(state("/upload", { album: "testalbum" }));

  expect((): void => {
    fromUIState({
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.Upload,
      },
    });
  }).toThrowAppError(ErrorCode.InvalidState);
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
        type: PageType.Index,
      },
    },
  }));

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
