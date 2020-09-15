/* eslint-disable react/display-name */
import { waitFor } from "@testing-library/react";
import mockConsole from "jest-mock-console";
import React from "react";

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
import type { AlbumPageProps } from "./album";
import type { CatalogPageProps } from "./catalog";
import { ErrorPageProps } from "./error";
import { AuthenticatedPageProps, PageType } from "./types";
import type { UserPageProps } from "./user";

jest.mock("./indexpage", (): unknown => {
  return () => <div id="index"/>;
});

jest.mock("./user", (): unknown => {
  return (props: UserPageProps) => <div id="user" data-user={props.user.email}/>;
});

jest.mock("./catalog", (): unknown => {
  return (props: CatalogPageProps) => <div
    id="catalog"
    data-user={props.user.email}
    data-catalog={props.catalog.id}
  />;
});

jest.mock("./album", (): unknown => {
  return (props: AlbumPageProps & AuthenticatedPageProps) => <div
    id="album"
    data-user={props.user.email}
    data-album={props.album.id}
  />;
});

jest.mock("./notfound", (): unknown => {
  return () => <div id="notfound"/>;
});

jest.mock("./error", (): unknown => {
  return (props: ErrorPageProps) => <div id="error" data-error={props.error}/>;
});

beforeEach(resetDOM);

test("index page", async (): Promise<void> => {
  const store = mockStore(mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  }));

  let { container } = render(<Page/>, store);
  expectChild(container, "#index");
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

  let { container } = render(<Page/>, store);
  let div = expectChild(container, "#error");
  expect(div.getAttribute("data-error")).toMatch("invalid-state");
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

  render(<Page/>, store);

  let { container } = render(<Page/>, store);
  let div = expectChild(container, "#error");
  expect(div.getAttribute("data-error")).toMatch("invalid-state");
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

  render(<Page/>, store);

  let { container } = render(<Page/>, store);
  let div = expectChild(container, "#error");
  expect(div.getAttribute("data-error")).toMatch("invalid-state");
});

test("user page logged in", async (): Promise<void> => {
  const store = mockStore(mockStoreState({
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
  const store = mockStore(mockStoreState({
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
  const store = mockStore(mockStoreState({
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

  let { container } = render(<Page/>, store);
  expectChild(container, "#notfound");
});
