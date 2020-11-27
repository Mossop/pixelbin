import React from "react";

import { Method } from "../../model";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { request } from "../api/api";
import { SavedSearch } from "../api/highlevel";
import {
  expect,
  render,
  expectChild,
  mockStore,
  mockStoreState,
  resetDOM,
  mockServerState,
  click,
  deferRequest,
} from "../test-helpers";
import SavedSearchDeleteOverlay from "./SavedSearchDelete";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("cancelled delete search", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      searches: [{
        id: "search1",
        name: "Search 1",
      }],
    }]),
  }));

  let { dialogContainer } = render(
    <SavedSearchDeleteOverlay search={SavedSearch.ref("search1")}/>,
    store,
  );

  expect(document.title).toBe("saved-search-delete-title");

  let message = expectChild<HTMLParagraphElement>(dialogContainer, ".MuiDialogContent-root p");
  let cancel = expectChild<HTMLButtonElement>(dialogContainer, "#confirm-dialog-cancel");

  expect(message.textContent).toEqual("saved-search-delete-description");

  click(cancel);

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).toHaveBeenCalledTimes(1);

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "closeOverlay",
    payload: [],
  });
});

test("accepted delete search", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      searches: [{
        id: "search1",
        name: "Search 1",
      }],
    }]),
  }));

  let { dialogContainer } = render(
    <SavedSearchDeleteOverlay search={SavedSearch.ref("search1")}/>,
    store,
  );

  expect(document.title).toBe("saved-search-delete-title");

  let accept = expectChild<HTMLButtonElement>(dialogContainer, "#confirm-dialog-accept");

  let { call, resolve } = deferRequest<Method.SavedSearchDelete>();

  click(accept);

  expect(await call).toEqual([Method.SavedSearchDelete, ["search1"]]);

  expect(store.dispatch).not.toHaveBeenCalled();

  await resolve();

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "searchDeleted",
    payload: [expect.toBeRef("search1")],
  });
});
