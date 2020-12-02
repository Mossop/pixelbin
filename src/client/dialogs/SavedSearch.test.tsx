import { waitFor } from "@testing-library/react";
import React from "react";

import type { Search } from "../../model";
import { Operator, Method } from "../../model";
import { awaitCall, lastCallArgs, mockedFunction } from "../../test-helpers";
import { request } from "../api/api";
import { Catalog, SavedSearch } from "../api/highlevel";
import {
  expect,
  render,
  expectChild,
  mockStore,
  mockStoreState,
  typeString,
  resetDOM,
  deferRequest,
  click,
  mockServerState,
} from "../test-helpers";
import SavedSearchDialog from "./SavedSearch";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("save search", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
    }]),
  }));

  let query: Search.FieldQuery = {
    type: "field",
    invert: false,
    field: "title",
    modifier: null,
    operator: Operator.Equal,
    value: "fii",
  };

  let { dialogContainer } = render(<SavedSearchDialog
    catalog={Catalog.ref("catalog")}
    query={query}
  />, store);

  expect(document.title).toBe("save-saved-search-title");

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let prv = expectChild<HTMLInputElement>(form, "#saved-search-private");
  expect(prv.checked).toBeTruthy();
  let pbl = expectChild<HTMLInputElement>(form, "#saved-search-public");
  expect(pbl.checked).toBeFalsy();

  click(pbl);
  expect(prv.checked).toBeFalsy();
  expect(pbl.checked).toBeTruthy();

  let name = expectChild<HTMLInputElement>(form, "input#saved-search-name");
  await typeString(name, "Hello");

  let button = expectChild<HTMLButtonElement>(form, "button#saved-search-submit");

  let { resolve } = deferRequest<Method.SavedSearchCreate>();

  click(button);

  await waitFor((): void => {
    expect(name.disabled).toBeTruthy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Method.SavedSearchCreate, {
    catalog: "catalog",
    search: {
      name: "Hello",
      shared: true,
      query,
    },
  }]);

  let dispatchCall = awaitCall(store.dispatch);

  await resolve({
    id: "newsearch",
    catalog: "catalog",
    name: "Hello2",
    shared: true,
    query,
  });

  let [deed] = await dispatchCall;

  expect(deed).toEqual({
    type: "searchSaved",
    payload: [{
      id: "newsearch",
      catalog: expect.toBeRef("catalog"),
      name: "Hello2",
      shared: true,
      query,
    }],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();
});

test("edit search", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      searches: [{
        id: "search1",
        name: "My search",
        shared: true,
      }],
    }]),
  }));

  let { dialogContainer } = render(<SavedSearchDialog
    search={SavedSearch.ref("search1")}
  />, store);

  expect(document.title).toBe("edit-saved-search-title");

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let prv = expectChild<HTMLInputElement>(form, "#saved-search-private");
  expect(prv.checked).toBeFalsy();
  let pbl = expectChild<HTMLInputElement>(form, "#saved-search-public");
  expect(pbl.checked).toBeTruthy();

  click(prv);
  expect(prv.checked).toBeTruthy();
  expect(pbl.checked).toBeFalsy();

  let name = expectChild<HTMLInputElement>(form, "input#saved-search-name");
  expect(name.value).toBe("My search");

  name.selectionStart = 0;
  name.selectionEnd = name.value.length;
  await typeString(name, "{backspace}");

  await typeString(name, "Updated");
  let { resolve } = deferRequest<Method.SavedSearchEdit>();

  let button = expectChild<HTMLButtonElement>(form, "button#saved-search-submit");
  click(button);

  await waitFor((): void => {
    expect(name.disabled).toBeTruthy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Method.SavedSearchEdit, {
    id: "search1",
    search: {
      name: "Updated",
      shared: false,
    },
  }]);

  let dispatchCall = awaitCall(store.dispatch);

  let query: Search.FieldQuery = {
    type: "field",
    invert: false,
    field: "title",
    modifier: null,
    operator: Operator.Equal,
    value: "fii",
  };

  await resolve({
    id: "search1",
    catalog: "catalog",
    name: "Updated",
    shared: false,
    query,
  });

  let [deed] = await dispatchCall;

  expect(deed).toEqual({
    type: "searchSaved",
    payload: [{
      id: "search1",
      catalog: expect.toBeRef("catalog"),
      name: "Updated",
      shared: false,
      query,
    }],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();
});

test("save private search", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
    }]),
  }));

  let query: Search.FieldQuery = {
    type: "field",
    invert: false,
    field: "title",
    modifier: null,
    operator: Operator.Equal,
    value: "fii",
  };

  let { dialogContainer } = render(<SavedSearchDialog
    catalog={Catalog.ref("catalog")}
    query={query}
  />, store);

  expect(document.title).toBe("save-saved-search-title");

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let prv = expectChild<HTMLInputElement>(form, "#saved-search-private");
  expect(prv.checked).toBeTruthy();
  let pbl = expectChild<HTMLInputElement>(form, "#saved-search-public");
  expect(pbl.checked).toBeFalsy();

  click(pbl);
  expect(prv.checked).toBeFalsy();
  expect(pbl.checked).toBeTruthy();

  click(prv);
  expect(prv.checked).toBeTruthy();
  expect(pbl.checked).toBeFalsy();

  let name = expectChild<HTMLInputElement>(form, "input#saved-search-name");
  await typeString(name, "Hello");

  let button = expectChild<HTMLButtonElement>(form, "button#saved-search-submit");

  let { resolve } = deferRequest<Method.SavedSearchCreate>();

  click(button);

  await waitFor((): void => {
    expect(name.disabled).toBeTruthy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Method.SavedSearchCreate, {
    catalog: "catalog",
    search: {
      name: "Hello",
      shared: false,
      query,
    },
  }]);

  let dispatchCall = awaitCall(store.dispatch);

  await resolve({
    id: "newsearch",
    catalog: "catalog",
    name: "Hello2",
    shared: false,
    query,
  });

  let [deed] = await dispatchCall;

  expect(deed).toEqual({
    type: "searchSaved",
    payload: [{
      id: "newsearch",
      catalog: expect.toBeRef("catalog"),
      name: "Hello2",
      shared: false,
      query,
    }],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();
});
