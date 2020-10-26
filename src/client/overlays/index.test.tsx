/* eslint-disable react/display-name */
import { waitFor } from "@testing-library/react";
import React from "react";

import Overlay from ".";
import { Catalog, Album } from "../api/highlevel";
import { PageType } from "../pages/types";
import {
  expect,
  expectChild,
  mockStore,
  mockStoreState,
  render,
} from "../test-helpers";
import type { AlbumOverlayProps } from "./Album";
import type { AlbumDeleteOverlayProps } from "./AlbumDelete";
import type { CatalogCreateOverlayProps } from "./CatalogCreate";
import type { CatalogEditOverlayProps } from "./CatalogEdit";
import { OverlayType } from "./types";

jest.mock("./Album", (): unknown => {
  return (props: AlbumOverlayProps) => {
    if ("album" in props) {
      return <div id="album-overlay" data-album={props.album.id}/>;
    } else {
      return <div id="album-overlay" data-parent={props.parent.id}/>;
    }
  };
});

jest.mock("./AlbumDelete", (): unknown => {
  return (props: AlbumDeleteOverlayProps) =>
    <div id="album-delete-overlay" data-album={props.album.id}/>;
});

jest.mock("./CatalogEdit", (): unknown => {
  return (props: CatalogEditOverlayProps) =>
    <div id="catalog-edit-overlay" data-catalog={props.catalog.id}/>;
});

jest.mock("./CatalogCreate", (): unknown => {
  return (props: CatalogCreateOverlayProps) =>
    <div id="catalog-create-overlay" data-user={props.user.email}/>;
});

jest.mock("./Login", (): unknown => {
  return () => <div id="login-overlay"/>;
});

jest.mock("./Signup", (): unknown => {
  return () => <div id="signup-overlay"/>;
});

test("no overlay", (): void => {
  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);

  let loading = container.querySelector(".loading");
  expect(loading).toBeNull();
});

test("login overlay", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.Login,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);
  expectChild(container, ".loading");

  await waitFor(() => expectChild(container, "#login-overlay"));

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("signup overlay", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.Signup,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);
  expectChild(container, ".loading");

  await waitFor(() => expectChild(container, "#signup-overlay"));

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("create album overlay", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.AlbumCreate,
        parent: Catalog.ref("catalog"),
      },
    },
  }));

  let { container } = render(<Overlay/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#album-overlay"));
  expect(div.getAttribute("data-parent")).toBe("catalog");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("edit album overlay", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.AlbumEdit,
        album: Album.ref("album"),
      },
    },
  }));

  let { container } = render(<Overlay/>, store);
  // The AlbumOverlay may have already resolved in the previous test.
  expectChild(container, "#album-overlay,.loading");

  let div = await waitFor(() => expectChild(container, "#album-overlay"));
  expect(div.getAttribute("data-album")).toBe("album");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("delete album overlay", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.AlbumDelete,
        album: Album.ref("album"),
      },
    },
  }));

  let { container } = render(<Overlay/>, store);
  // The AlbumOverlay may have already resolved in the previous test.
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#album-delete-overlay"));
  expect(div.getAttribute("data-album")).toBe("album");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("create catalog overlay", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.CatalogCreate,
      },
    },
  }));

  let { container } = render(<Overlay/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#catalog-create-overlay"));
  expect(div.getAttribute("data-user")).toBe(store.state.serverState.user?.email);

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("edit catalog overlay", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.CatalogEdit,
        catalog: Catalog.ref("catref"),
      },
    },
  }));

  let { container } = render(<Overlay/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#catalog-edit-overlay"));
  expect(div.getAttribute("data-catalog")).toBe("catref");

  expect(store.dispatch).not.toHaveBeenCalled();
});
