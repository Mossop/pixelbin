/* eslint-disable react/display-name */
import { waitFor } from "@testing-library/react";
import mockConsole from "jest-mock-console";

import Page from ".";
import { Album, Catalog } from "../api/highlevel";
import {
  expect,
  render,
  resetDOM,
  mockStore,
  mockStoreState,
  expectChild,
} from "../test-helpers";
import type { AlbumPageProps } from "./Album";
import type { CatalogPageProps } from "./Catalog";
import type { ErrorPageProps } from "./Error";
import type { AuthenticatedPageProps } from "./types";
import { PageType } from "./types";

jest.mock("./Root", (): unknown => {
  return () => <div id="index"/>;
});

jest.mock("./User", (): unknown => {
  return (props: AuthenticatedPageProps) => <div id="user" data-user={props.user.email}/>;
});

jest.mock("./Catalog", (): unknown => {
  return (props: CatalogPageProps & AuthenticatedPageProps) => <div
    id="catalog"
    data-user={props.user.email}
    data-catalog={props.catalog.id}
  />;
});

jest.mock("./Album", (): unknown => {
  return (props: AlbumPageProps & AuthenticatedPageProps) => <div
    id="album"
    data-user={props.user.email}
    data-album={props.album.id}
  />;
});

jest.mock("./NotFound", (): unknown => {
  return () => <div id="notfound"/>;
});

jest.mock("./Error", (): unknown => {
  return (props: ErrorPageProps) => <div id="error" data-error={props.error}/>;
});

beforeEach(resetDOM);

test("index page", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Root,
      },
    },
  }));

  let { container } = render(<Page/>, store);
  expectChild(container, "#index");
});

test("user page not logged in", (): void => {
  mockConsole();

  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.User,
      },
    },
  }));

  let { container } = render(<Page/>, store);
  let div = expectChild(container, "#error");
  expect(div.getAttribute("data-error")).toMatch("invalid-state");
});

test("album page not logged in", (): void => {
  mockConsole();

  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("foo"),
      },
    },
  }));

  render(<Page/>, store);

  let { container } = render(<Page/>, store);
  let div = expectChild(container, "#error");
  expect(div.getAttribute("data-error")).toMatch("invalid-state");
});

test("catalog page not logged in", (): void => {
  mockConsole();

  let store = mockStore(mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Catalog,
        catalog: Catalog.ref("foo"),
      },
    },
  }));

  render(<Page/>, store);

  let { container } = render(<Page/>, store);
  let div = expectChild(container, "#error");
  expect(div.getAttribute("data-error")).toMatch("invalid-state");
});

test("user page logged in", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.User,
      },
    },
  }));

  let { container } = render(<Page/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#user"));
  expect(div.getAttribute("data-user")).toBe(store.state.serverState.user?.email);
});

test("album page logged in", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("foo"),
      },
    },
  }));

  let { container } = render(<Page/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#album"));
  expect(div.getAttribute("data-album")).toBe("foo");
  expect(div.getAttribute("data-user")).toBe(store.state.serverState.user?.email);
});

test("catalog page logged in", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Catalog,
        catalog: Catalog.ref("foo"),
      },
    },
  }));

  let { container } = render(<Page/>, store);
  expectChild(container, ".loading");

  let div = await waitFor(() => expectChild(container, "#catalog"));
  expect(div.getAttribute("data-catalog")).toBe("foo");
  expect(div.getAttribute("data-user")).toBe(store.state.serverState.user?.email);
});

test("not found page", (): void => {
  let store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.NotFound,
        history: {
          path: "/",
        },
      },
    },
  }));

  let { container } = render(<Page/>, store);
  expectChild(container, "#notfound");
});
