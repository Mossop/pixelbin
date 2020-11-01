import { waitFor } from "@testing-library/react";
import React from "react";

import { Method } from "../../model";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { request } from "../api/api";
import { Catalog, Album } from "../api/highlevel";
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
import AlbumOverlay from "./Album";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("create album", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
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

  let { dialogContainer } = render(<AlbumOverlay parent={Catalog.ref("catalog")}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");
  let button = expectChild<HTMLButtonElement>(form, "#album-create-submit");
  click(button);

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  let nameInput = expectChild<HTMLInputElement>(form, "#album-name");
  typeString(nameInput, "Foo");

  let { resolve } = deferRequest<Method.AlbumCreate>();

  click(button);

  await waitFor((): void => {
    expect(nameInput.disabled).toBeTruthy();
  });

  expect(lastCallArgs(mockedRequest)).toEqual([Method.AlbumCreate, {
    catalog: "catalog",
    album: {
      parent: null,
      name: "Foo",
    },
  }]);

  await resolve({
    id: "album3",
    catalog: "catalog",
    name: "Foo",
    parent: null,
  });

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "albumCreated",
    payload: [{
      id: "album3",
      catalog: expect.toBeRef("catalog"),
      name: "Foo",
      parent: null,
    }],
  });
});

test("edit album", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
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

  let { dialogContainer } = render(<AlbumOverlay album={Album.ref("album2")}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let nameInput = expectChild<HTMLInputElement>(dialogContainer, "#album-name");
  expect(nameInput.value).toBe("Album 2");

  typeString(nameInput, "");

  let button = expectChild<HTMLButtonElement>(form, "#album-edit-submit");
  click(button);

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  typeString(nameInput, "Foo");

  let { resolve } = deferRequest<Method.AlbumEdit>();

  click(button);

  await waitFor((): void => {
    expect(nameInput.disabled).toBeTruthy();
  });

  expect(lastCallArgs(mockedRequest)).toEqual([Method.AlbumEdit, {
    id: "album2",
    album: {
      parent: "album1",
      name: "Foo",
    },
  }]);

  await resolve({
    id: "album2",
    catalog: "catalog",
    name: "Foo",
    parent: "album1",
  });

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "albumEdited",
    payload: [{
      id: "album2",
      catalog: expect.toBeRef("catalog"),
      name: "Foo",
      parent: expect.toBeRef("album1"),
    }],
  });
});
