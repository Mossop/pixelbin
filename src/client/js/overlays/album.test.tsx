import { waitFor } from "@testing-library/react";
import React from "react";

import { Api } from "../../../model";
import { lastCallArgs, mockedFunction } from "../../../test-helpers";
import { request } from "../api/api";
import { Catalog, Album } from "../api/highlevel";
import { AlbumState } from "../api/types";
import {
  expect,
  render,
  expectChild,
  mockStore,
  mockStoreState,
  typeString,
  resetDOM,
  mockServerState,
  click,
  deferRequest,
} from "../test-helpers";
import AlbumOverlay from "./album";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("create album", async (): Promise<void> => {
  const store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      albums: [{
        id: "album1",
        name: "Album 1",
      }, {
        id: "album2",
        name: "Album 2",
      }],
    }]),
  }));

  let { container } = render(<AlbumOverlay parent={Catalog.ref("catalog")}/>, store);

  let form = expectChild<HTMLFormElement>(container, "form.form");
  form.submit();

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  let nameInput = expectChild<HTMLInputElement>(container, "#album-overlay-name");
  typeString(nameInput, "Foo");

  let selected = expectChild(container, ".site-tree .selected");
  expect(selected.textContent).toBe("Catalog");

  let title = expectChild(container, "#overlay-header .title");
  expect(title.textContent).toBe("album-create-title");

  let { resolve } = deferRequest<AlbumState>();

  form.submit();

  await waitFor((): void => {
    expect(nameInput.disabled).toBeTruthy();
  });

  expect(lastCallArgs(mockedRequest)).toEqual([Api.Method.AlbumCreate, {
    catalog: expect.toBeRef("catalog"),
    parent: null,
    name: "Foo",
  }]);

  let albumState: AlbumState = {
    id: "album3",
    catalog: Catalog.ref("catalog"),
    name: "Foo",
    parent: null,
  };

  await resolve(albumState);

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "albumCreated",
    payload: [albumState],
  });
});

test("edit album", async (): Promise<void> => {
  const store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      albums: [{
        id: "album1",
        name: "Album 1",
        children: [{
          id: "album2",
          name: "Album 2",
        }],
      }],
    }]),
  }));

  let { container } = render(<AlbumOverlay album={Album.ref("album2")}/>, store);

  let form = expectChild<HTMLFormElement>(container, "form.form");

  let nameInput = expectChild<HTMLInputElement>(container, "#album-overlay-name");
  expect(nameInput.value).toBe("Album 2");

  typeString(nameInput, "");

  form.submit();

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  typeString(nameInput, "Foo");

  let selected = expectChild(container, ".site-tree .selected");
  expect(selected.textContent).toBe("Album 1");

  let title = expectChild(container, "#overlay-header .title");
  expect(title.textContent).toBe("album-edit-title");

  let catalog = expectChild(container, ".site-tree .depth0 > button");
  click(catalog);

  let { resolve } = deferRequest<AlbumState>();

  form.submit();

  await waitFor((): void => {
    expect(nameInput.disabled).toBeTruthy();
  });

  expect(lastCallArgs(mockedRequest)).toEqual([Api.Method.AlbumEdit, {
    id: expect.toBeRef("album2"),
    catalog: expect.toBeRef("catalog"),
    parent: null,
    name: "Foo",
  }]);

  let AlbumState: AlbumState = {
    id: "album2",
    catalog: Catalog.ref("catalog"),
    name: "Foo",
    parent: null,
  };

  await resolve(AlbumState);

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "albumEdited",
    payload: [AlbumState],
  });
});
