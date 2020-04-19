import { Catalog, Album } from "../../js/api/highlevel";
import { ServerData } from "../../js/api/types";
import { OverlayType } from "../../js/overlays";
import { PageType } from "../../js/pages";
import { HistoryState } from "../../js/utils/history";
import { intoUIState, fromUIState } from "../../js/utils/navigation";
import { reset, buildServerData, pxExpect as expect } from "../utils";

beforeEach(reset);

function state(path: string, params?: {}): HistoryState {
  return {
    path,
    params: params ? new Map(Object.entries(params)) : undefined,
  };
}

const LoggedOut: ServerData = {
  user: null,
};

const LoggedIn = buildServerData([{
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
});
