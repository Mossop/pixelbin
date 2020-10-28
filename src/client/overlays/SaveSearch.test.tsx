import { waitFor } from "@testing-library/react";
import React from "react";

import type { Api, Search } from "../../model";
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

  let name = expectChild<HTMLInputElement>(form, "input#save-search-name");
  typeString(name, "Hello");

  let button = expectChild<HTMLButtonElement>(form, "button#save-search-submit");

  let { resolve } = deferRequest<Api.SavedSearch>();

  click(button);

  await waitFor((): void => {
    expect(name.disabled).toBeTruthy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Method.SavedSearchCreate, {
    catalog: "catalog",
    name: "Hello",
    query,
  }]);

  let dispatchCall = awaitCall(store.dispatch);

  await resolve({
    id: "newsearch",
    catalog: "catalog",
    name: "Hello2",
    query,
  });

  let [deed] = await dispatchCall;

  expect(deed).toEqual({
    type: "searchSaved",
    payload: [{
      id: "newsearch",
      catalog: expect.toBeRef("catalog"),
      name: "Hello2",
      query,
    }],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();
});
