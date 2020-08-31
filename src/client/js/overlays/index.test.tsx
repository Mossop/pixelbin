import mockConsole from "jest-mock-console";
import React from "react";

import Overlay from ".";
import { lastCallArgs, mockedFunction } from "../../../test-helpers";
import { Catalog, Album } from "../api/highlevel";
import { PageType } from "../pages/types";
import {
  expect,
  mockStore,
  mockStoreState,
  render,
} from "../test-helpers";
import AlbumOverlay from "./album";
import CatalogOverlay from "./catalog";
import LoginOverlay from "./login";
import SignupOverlay from "./signup";
import { OverlayType } from "./types";

jest.mock("./album", (): unknown => {
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

jest.mock("./login", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("./signup", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

const mockedAlbum = mockedFunction(AlbumOverlay);
const mockedCatalog = mockedFunction(CatalogOverlay);
const mockedLogin = mockedFunction(LoginOverlay);
const mockedSignup = mockedFunction(SignupOverlay);

test("no overlay", (): void => {
  const store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  }));

  render(<Overlay/>, store);

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
});

test("login overlay", (): void => {
  const store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.Login,
      },
    },
  }));

  render(<Overlay/>, store);

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("bad login", (): void => {
  mockConsole();

  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.Login,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);

  expect(container.querySelector("#overlay")).toBeNull();

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
});

test("signup overlay", (): void => {
  const store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.Signup,
      },
    },
  }));

  render(<Overlay/>, store);

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).toHaveBeenCalled();
});

test("bad signup", (): void => {
  mockConsole();

  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.Signup,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);

  expect(container.querySelector("#overlay")).toBeNull();

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
});

test("create album overlay", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.CreateAlbum,
        parent: Catalog.ref("catalog"),
      },
    },
  }));

  render(<Overlay/>, store);

  expect(lastCallArgs(mockedAlbum)[0]).toEqual({
    parent: expect.toBeRef("catalog"),
  });
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
});

test("edit album overlay", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.EditAlbum,
        album: Album.ref("album"),
      },
    },
  }));

  render(<Overlay/>, store);

  expect(lastCallArgs(mockedAlbum)[0]).toEqual({
    album: expect.toBeRef("album"),
  });
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
});

test("bad album", (): void => {
  mockConsole();

  const store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.CreateAlbum,
        parent: Catalog.ref("catalog"),
      },
    },
  }));

  render(<Overlay/>, store);

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
});

test("create catalog overlay", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.CreateCatalog,
      },
    },
  }));

  render(<Overlay/>, store);

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(lastCallArgs(mockedCatalog)[0]).toEqual({
    user: store.state.serverState.user,
  });
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
});
