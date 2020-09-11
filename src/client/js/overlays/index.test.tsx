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
import type { AlbumOverlayProps } from "./album";
import type { CreateCatalogOverlayProps } from "./CreateCatalog";
import { OverlayType } from "./types";

jest.mock("./album", (): unknown => {
  return (props: AlbumOverlayProps) => {
    if ("album" in props) {
      return <div id="album-overlay" data-album={props.album.id}/>;
    } else {
      return <div id="album-overlay" data-parent={props.parent.id}/>;
    }
  };
});

jest.mock("./CreateCatalog", (): unknown => {
  return (props: CreateCatalogOverlayProps) =>
    <div id="catalog-overlay" data-user={props.user.email}/>;
});

jest.mock("./login", (): unknown => {
  return () => <div id="login-overlay"/>;
});

jest.mock("./signup", (): unknown => {
  return () => <div id="signup-overlay"/>;
});

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

  let loading = container.querySelector(".loading");
  expect(loading).toBeNull();
});

test("login overlay", async (): Promise<void> => {
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
  expectChild(container, ".loading");

  await waitFor(() => expectChild(container, "#login-overlay"));

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("signup overlay", async (): Promise<void> => {
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
  expectChild(container, ".loading");

  await waitFor(() => expectChild(container, "#signup-overlay"));

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("create album overlay", async (): Promise<void> => {
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
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#album-overlay"));
  expect(div.getAttribute("data-parent")).toBe("catalog");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("edit album overlay", async (): Promise<void> => {
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
  // The AlbumOverlay may have already resolved in the previous test.
  expectChild(container, "#album-overlay,.loading");

  let div = await waitFor(() => expectChild(container, "#album-overlay"));
  expect(div.getAttribute("data-album")).toBe("album");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("create catalog overlay", async (): Promise<void> => {
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
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#catalog-overlay"));
  expect(div.getAttribute("data-user")).toBe(store.state.serverState.user?.email);

  expect(store.dispatch).not.toHaveBeenCalled();
});
