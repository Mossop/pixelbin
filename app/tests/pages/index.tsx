import React from "react";

import { Album, Catalog } from "../../js/api/highlevel";
import Page from "../../js/pages";
import AlbumPage from "../../js/pages/album";
import CatalogPage from "../../js/pages/catalog";
import ErrorPage from "../../js/pages/error";
import IndexPage from "../../js/pages/indexpage";
import NotFoundPage from "../../js/pages/notfound";
import { PageType } from "../../js/pages/types";
import UserPage from "../../js/pages/user";
import store from "../../js/store";
import actions from "../../js/store/actions";
import { expect, render, resetDOM, mockedClass, lastCallArgs } from "../helpers";

jest.mock("../../js/pages/indexpage", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("../../js/pages/user", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("../../js/pages/catalog", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("../../js/pages/album", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("../../js/pages/notfound", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("../../js/pages/error", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

const mockedIndex = mockedClass(IndexPage);
const mockedUser = mockedClass(UserPage);
const mockedAlbum = mockedClass(AlbumPage);
const mockedCatalog = mockedClass(CatalogPage);
const mockedNotFound = mockedClass(NotFoundPage);
const mockedError = mockedClass(ErrorPage);

beforeEach((): void => {
  resetDOM();

  mockedIndex.mockClear();
  mockedUser.mockClear();
  mockedAlbum.mockClear();
  mockedCatalog.mockClear();
});

test("index page", (): void => {
  store.dispatch(actions.updateUIState({
    page: {
      type: PageType.Index,
    },
  }));

  render(<Page/>);

  expect(mockedIndex).toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(lastCallArgs(mockedIndex)[0]).toEqual({});
});

test("user page", (): void => {
  store.dispatch(actions.updateUIState({
    page: {
      type: PageType.User,
    },
  }));

  render(<Page/>);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(lastCallArgs(mockedUser)[0]).toEqual({});
});

test("album page", (): void => {
  store.dispatch(actions.updateUIState({
    page: {
      type: PageType.Album,
      album: Album.ref("foo"),
    },
  }));

  render(<Page/>);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(lastCallArgs(mockedAlbum)[0]).toEqual({
    album: expect.toBeRef("foo"),
  });
});

test("catalog page", (): void => {
  store.dispatch(actions.updateUIState({
    page: {
      type: PageType.Catalog,
      catalog: Catalog.ref("foo"),
    },
  }));

  render(<Page/>);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).toHaveBeenCalled();
  expect(mockedNotFound).not.toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(lastCallArgs(mockedCatalog)[0]).toEqual({
    catalog: expect.toBeRef("foo"),
  });
});

test("not found page", (): void => {
  store.dispatch(actions.updateUIState({
    page: {
      type: PageType.NotFound,
      history: {
        path: "/",
      },
    },
  }));

  render(<Page/>);

  expect(mockedIndex).not.toHaveBeenCalled();
  expect(mockedUser).not.toHaveBeenCalled();
  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedNotFound).toHaveBeenCalled();
  expect(mockedError).not.toHaveBeenCalled();

  expect(lastCallArgs(mockedNotFound)[0]).toEqual({});
});

test("error page", (): void => {
  store.dispatch(actions.updateUIState({
    page: {
      type: PageType.Index,
    },
  }));

  mockedIndex.mockImplementation((): never => {
    throw new Error("Test error message.");
  });

  render(<Page/>);

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
