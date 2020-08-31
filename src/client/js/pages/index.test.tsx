import mockConsole from "jest-mock-console";
import React from "react";

import { lastCallArgs, mockedFunction } from "../../../test-helpers";
import { Album, Catalog } from "../api/highlevel";
import App from "../components/App";
import {
  expect,
  render,
  resetDOM,
  mockStore,
  mockStoreState,
} from "../test-helpers";
import AlbumPage from "./album";
import CatalogPage from "./catalog";
import ErrorPage from "./error";
import IndexPage from "./indexpage";
import NotFoundPage from "./notfound";
import { PageType } from "./types";
import UserPage from "./user";

jest.mock("./indexpage", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("./user", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("./catalog", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("./album", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("./notfound", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("./error", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

const mockedIndex = mockedFunction(IndexPage);
const mockedUser = mockedFunction(UserPage);
const mockedAlbum = mockedFunction(AlbumPage);
const mockedCatalog = mockedFunction(CatalogPage);
const mockedNotFound = mockedFunction(NotFoundPage);
const mockedError = mockedFunction(ErrorPage);

beforeEach(resetDOM);

test("index page", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  }));

  render(<App/>, store);

  expect(mockedIndex).toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(mockedIndex).toHaveBeenCalled();
});

test("user page not logged in", (): void => {
  mockConsole();

  const store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.User,
      },
    },
  }));

  render(<App/>, store);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).toHaveBeenCalled();

  expect(lastCallArgs(mockedError)[0]).toEqual({
    error: "Internal error.",
  });
});

test("album page not logged in", (): void => {
  mockConsole();

  const store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("foo"),
      },
    },
  }));

  render(<App/>, store);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).toHaveBeenCalled();

  expect(lastCallArgs(mockedError)[0]).toEqual({
    error: "Internal error.",
  });
});

test("catalog page not logged in", (): void => {
  mockConsole();

  const store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Catalog,
        catalog: Catalog.ref("foo"),
      },
    },
  }));

  render(<App/>, store);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).toHaveBeenCalled();

  expect(lastCallArgs(mockedError)[0]).toEqual({
    error: "Internal error.",
  });
});

test("user page logged in", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.User,
      },
    },
  }));

  render(<App/>, store);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(lastCallArgs(mockedUser)[0]).toEqual({
    user: store.state.serverState.user,
  });
});

test("album page logged in", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("foo"),
      },
    },
  }));

  render(<App/>, store);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(lastCallArgs(mockedAlbum)[0]).toEqual({
    album: expect.toBeRef("foo"),
    user: store.state.serverState.user,
  });
});

test("catalog page logged in", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Catalog,
        catalog: Catalog.ref("foo"),
      },
    },
  }));

  render(<App/>, store);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(lastCallArgs(mockedCatalog)[0]).toEqual({
    user: store.state.serverState.user,
    catalog: expect.toBeRef("foo"),
  });
});

test("not found page", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.NotFound,
        history: {
          path: "/",
        },
      },
    },
  }));

  render(<App/>, store);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(mockedNotFound).toHaveBeenCalled();
});

test("error page", (): void => {
  mockConsole();

  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  }));

  mockedIndex.mockImplementation((): never => {
    throw new Error("Test error message.");
  });

  render(<App/>, store);

  expect(mockedIndex).toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).toHaveBeenCalled();

  expect(lastCallArgs(mockedError)[0]).toEqual({
    error: "Error: Test error message.",
  });
});
