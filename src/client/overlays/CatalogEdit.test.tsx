import { waitFor } from "@testing-library/react";
import React from "react";

import { Api, Method } from "../../model";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { request } from "../api/api";
import { Catalog } from "../api/highlevel";
import {
  mockStore,
  mockStoreState,
  mockServerState,
  expectChild,
  typeString,
  click,
  deferRequest,
  render,
  resetDOM,
} from "../test-helpers";
import CatalogEditOverlay from "./CatalogEdit";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("edit catalog", async (): Promise<void> => {
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

  let { dialogContainer } = render(<CatalogEditOverlay catalog={Catalog.ref("catalog")}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let nameInput = expectChild<HTMLInputElement>(dialogContainer, "#catalog-name");
  expect(nameInput.value).toBe("Catalog");

  typeString(nameInput, "");

  let button = expectChild<HTMLButtonElement>(form, "#catalog-edit-submit");
  click(button);

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  typeString(nameInput, "Foo");

  let { resolve } = deferRequest<Api.Catalog>();

  click(button);

  await waitFor((): void => {
    expect(nameInput.disabled).toBeTruthy();
  });

  expect(lastCallArgs(mockedRequest)).toEqual([Method.CatalogEdit, {
    id: "catalog",
    name: "Foo",
  }]);

  await resolve({
    id: "catalog",
    name: "Foo",
    storage: "s1",
  });

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "catalogEdited",
    payload: [{
      id: "catalog",
      name: "Foo",
      storage: "s1",
    }],
  });
});
