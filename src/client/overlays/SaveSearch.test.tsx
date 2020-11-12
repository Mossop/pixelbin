import { waitFor } from "@testing-library/react";
import React from "react";

import type { Search } from "../../model";
import { Operator, Method } from "../../model";
import { awaitCall, lastCallArgs, mockedFunction } from "../../test-helpers";
import { request } from "../api/api";
import { Catalog } from "../api/highlevel";
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
import SaveSearchOverlay from "./SaveSearch";

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

  let { dialogContainer } = render(<SaveSearchOverlay
    catalog={Catalog.ref("catalog")}
    query={query}
  />, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let prv = expectChild<HTMLInputElement>(form, "#save-search-private");
  expect(prv.checked).toBeTruthy();
  let pbl = expectChild<HTMLInputElement>(form, "#save-search-public");
  expect(pbl.checked).toBeFalsy();

  click(pbl);
  expect(prv.checked).toBeFalsy();
  expect(pbl.checked).toBeTruthy();

  let name = expectChild<HTMLInputElement>(form, "input#save-search-name");
  await typeString(name, "Hello");

  let button = expectChild<HTMLButtonElement>(form, "button#save-search-submit");

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
