/* eslint-disable react/display-name */
import { waitFor } from "@testing-library/react";

import Dialog from ".";
import { Operator } from "../../model";
import { Catalog, Album } from "../api/highlevel";
import { PageType } from "../pages/types";
import {
  expect,
  expectChild,
  mockStore,
  mockStoreState,
  render,
} from "../test-helpers";
import type { AlbumDialogProps } from "./Album";
import type { AlbumDeleteDialogProps } from "./AlbumDelete";
import type { CatalogCreateDialogProps } from "./CatalogCreate";
import type { CatalogEditDialogProps } from "./CatalogEdit";
import { DialogType } from "./types";

jest.mock("./Album", (): unknown => {
  return (props: AlbumDialogProps) => {
    if ("album" in props) {
      return <div id="album-dialog" data-album={props.album.id}/>;
    } else {
      return <div id="album-dialog" data-parent={props.parent.id}/>;
    }
  };
});

jest.mock("./AlbumDelete", (): unknown => {
  return (props: AlbumDeleteDialogProps) =>
    <div id="album-delete-dialog" data-album={props.album.id}/>;
});

jest.mock("./CatalogEdit", (): unknown => {
  return (props: CatalogEditDialogProps) =>
    <div id="catalog-edit-dialog" data-catalog={props.catalog.id}/>;
});

jest.mock("./CatalogCreate", (): unknown => {
  return (props: CatalogCreateDialogProps) =>
    <div id="catalog-create-dialog" data-user={props.user.email}/>;
});

jest.mock("./Login", (): unknown => {
  return () => <div id="login-dialog"/>;
});

jest.mock("./Signup", (): unknown => {
  return () => <div id="signup-dialog"/>;
});

jest.mock("./Search", (): unknown => {
  return () => <div id="search-dialog"/>;
});

jest.mock("./SavedSearch", (): unknown => {
  return () => <div id="saved-search-dialog"/>;
});

test("no dialog", (): void => {
  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  }));

  let { container } = render(<Dialog/>, store);

  let loading = container.querySelector(".loading");
  expect(loading).toBeNull();
});

test("login dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.Login,
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  expectChild(container, ".loading");

  await waitFor(() => expectChild(container, "#login-dialog"));

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("signup dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.Signup,
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  expectChild(container, ".loading");

  await waitFor(() => expectChild(container, "#signup-dialog"));

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("create album dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.AlbumCreate,
        parent: Catalog.ref("catalog"),
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#album-dialog"));
  expect(div.getAttribute("data-parent")).toBe("catalog");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("edit album dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.AlbumEdit,
        album: Album.ref("album"),
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  // The AlbumDialog may have already resolved in the previous test.
  expectChild(container, "#album-dialog,.loading");

  let div = await waitFor(() => expectChild(container, "#album-dialog"));
  expect(div.getAttribute("data-album")).toBe("album");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("delete album dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.AlbumDelete,
        album: Album.ref("album"),
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  // The AlbumDialog may have already resolved in the previous test.
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#album-delete-dialog"));
  expect(div.getAttribute("data-album")).toBe("album");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("create catalog dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.CatalogCreate,
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#catalog-create-dialog"));
  expect(div.getAttribute("data-user")).toBe(store.state.serverState.user?.email);

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("edit catalog dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.CatalogEdit,
        catalog: Catalog.ref("catref"),
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#catalog-edit-dialog"));
  expect(div.getAttribute("data-catalog")).toBe("catref");

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("search dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.Search,
        catalog: Catalog.ref("catref"),
        query: {
          type: "field",
          invert: false,
          field: "title",
          modifier: null,
          operator: Operator.Equal,
          value: "fii",
        },
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  expectChild(container, ".loading");

  await waitFor(() => expectChild(container, "#search-dialog"));

  expect(store.dispatch).not.toHaveBeenCalled();
});

test("save search dialog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
      dialog: {
        type: DialogType.SavedSearchCreate,
        catalog: Catalog.ref("catref"),
        query: {
          type: "field",
          invert: false,
          field: "title",
          modifier: null,
          operator: Operator.Equal,
          value: "fii",
        },
      },
    },
  }));

  let { container } = render(<Dialog/>, store);
  expectChild(container, ".loading");

  await waitFor(() => expectChild(container, "#saved-search-dialog"));

  expect(store.dispatch).not.toHaveBeenCalled();
});
