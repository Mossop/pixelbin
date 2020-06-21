import { fireEvent } from "@testing-library/react";
import mockConsole from "jest-mock-console";
import React from "react";

import Overlay from ".";
import { Catalog, Album } from "../api/highlevel";
import { PageType } from "../pages/types";
import {
  expect,
  mockedClass,
  mockStore,
  mockStoreState,
  render,
  expectChild,
  lastCallArgs,
  click,
} from "../test-helpers";
import AlbumOverlay from "./album";
import CatalogOverlay from "./catalog";
import LoginOverlay from "./login";
import SignupOverlay from "./signup";
import { OverlayType } from "./types";
import UploadOverlay from "./upload";

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

jest.mock("./upload", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

const mockedAlbum = mockedClass(AlbumOverlay);
const mockedCatalog = mockedClass(CatalogOverlay);
const mockedLogin = mockedClass(LoginOverlay);
const mockedSignup = mockedClass(SignupOverlay);
const mockedUpload = mockedClass(UploadOverlay);

test("no overlay", (): void => {
  const store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);

  expect(container.querySelector("#overlay")).toBeNull();

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(mockedUpload).not.toHaveBeenCalled();
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

  let { container } = render(<Overlay/>, store);

  let overlay = expectChild(container, "#overlay.login");

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(lastCallArgs(mockedLogin)[0]).toEqual({});
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(mockedUpload).not.toHaveBeenCalled();

  expect(store.dispatch).not.toHaveBeenCalled();

  fireEvent.keyDown(document, {
    key: "Escape",
  });

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "closeOverlay",
    payload: [],
  });

  store.dispatch.mockClear();

  fireEvent.keyDown(document, {
    key: "R",
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  click(overlay);

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "closeOverlay",
    payload: [],
  });

  store.dispatch.mockClear();

  click(expectChild(overlay, "#overlay-pane"));

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
  expect(mockedUpload).not.toHaveBeenCalled();
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

  let { container } = render(<Overlay/>, store);

  expectChild(container, "#overlay.signup");

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(lastCallArgs(mockedSignup)[0]).toEqual({});
  expect(mockedUpload).not.toHaveBeenCalled();
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
  expect(mockedUpload).not.toHaveBeenCalled();
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

  let { container } = render(<Overlay/>, store);

  expectChild(container, "#overlay.createAlbum");

  expect(lastCallArgs(mockedAlbum)[0]).toEqual({
    parent: expect.toBeRef("catalog"),
  });
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(mockedUpload).not.toHaveBeenCalled();
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

  let { container } = render(<Overlay/>, store);

  expectChild(container, "#overlay.editAlbum");

  expect(lastCallArgs(mockedAlbum)[0]).toEqual({
    album: expect.toBeRef("album"),
  });
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(mockedUpload).not.toHaveBeenCalled();
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

  let { container } = render(<Overlay/>, store);

  expect(container.querySelector("#overlay")).toBeNull();

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(mockedUpload).not.toHaveBeenCalled();
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

  let { container } = render(<Overlay/>, store);

  expectChild(container, "#overlay.createCatalog");

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(lastCallArgs(mockedCatalog)[0]).toEqual({
    user: store.state.serverState.user,
  });
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(mockedUpload).not.toHaveBeenCalled();
});

test("upload from album overlay", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("album"),
      },
      overlay: {
        type: OverlayType.Upload,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);

  expectChild(container, "#overlay.upload");

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(lastCallArgs(mockedUpload)[0]).toEqual({
    target: expect.toBeRef("album"),
  });
});

test("upload from catalog overlay", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Catalog,
        catalog: Catalog.ref("catalog"),
      },
      overlay: {
        type: OverlayType.Upload,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);

  expectChild(container, "#overlay.upload");

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(lastCallArgs(mockedUpload)[0]).toEqual({
    target: expect.toBeRef("catalog"),
  });
});

test("upload from other", (): void => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.Upload,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);

  expectChild(container, "#overlay.upload");

  expect(mockedAlbum).not.toHaveBeenCalled();
  expect(mockedCatalog).not.toHaveBeenCalled();
  expect(mockedLogin).not.toHaveBeenCalled();
  expect(mockedSignup).not.toHaveBeenCalled();
  expect(lastCallArgs(mockedUpload)[0]).toEqual({
    target: undefined,
  });
});
