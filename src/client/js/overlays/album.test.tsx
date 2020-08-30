import { act, waitFor } from "@testing-library/react";
import React from "react";

import { Api } from "../../../model";
import { lastCallArgs, mockedFunction } from "../../../test-helpers";
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

  let { dialogContainer } = render(<AlbumOverlay parent={Catalog.ref("catalog")}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");
  let button = expectChild<HTMLButtonElement>(form, "#dialog-submit");
  click(button);

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  let nameInput = expectChild<HTMLInputElement>(form, "#dialog-name");
  typeString(nameInput, "Foo");

  let { resolve } = deferRequest<Api.Album>();

  click(button);

  await waitFor((): void => {
    expect(nameInput.disabled).toBeTruthy();
  });

  expect(lastCallArgs(mockedRequest)).toEqual([Api.Method.AlbumCreate, {
    catalog: "catalog",
    parent: null,
    name: "Foo",
  }]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  await act(() => resolve({
    id: "album3",
    catalog: "catalog",
    name: "Foo",
    parent: null,
  }));

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "albumCreated",
    payload: [{
      id: "album3",
      catalog: expect.toBeRef("catalog"),
      name: "Foo",
      parent: null,
    }],
  });

  await waitFor((): void => {
    expect(nameInput.disabled).toBeFalsy();
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

  let { dialogContainer } = render(<AlbumOverlay album={Album.ref("album2")}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let nameInput = expectChild<HTMLInputElement>(dialogContainer, "#dialog-name");
  expect(nameInput.value).toBe("Album 2");

  typeString(nameInput, "");

  let button = expectChild<HTMLButtonElement>(form, "#dialog-submit");
  click(button);

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  typeString(nameInput, "Foo");

  let { resolve } = deferRequest<Api.Album>();

  click(button);

  await waitFor((): void => {
    expect(nameInput.disabled).toBeTruthy();
  });

  expect(lastCallArgs(mockedRequest)).toEqual([Api.Method.AlbumEdit, {
    id: "album2",
    parent: "album1",
    name: "Foo",
  }]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  await act(() => resolve({
    id: "album2",
    catalog: "catalog",
    name: "Foo",
    parent: "album1",
  }));

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "albumEdited",
    payload: [{
      id: "album2",
      catalog: expect.toBeRef("catalog"),
      name: "Foo",
      parent: expect.toBeRef("album1"),
    }],
  });

  await waitFor((): void => {
    expect(nameInput.disabled).toBeFalsy();
  });
});
