import mockConsole from "jest-mock-console";
import React from "react";

import { Api } from "../../../model";
import { lastCallArgs, mockedFunction } from "../../../test-helpers";
import { request } from "../api/api";
import {
  expect,
  render,
  expectChild,
  mockStore,
  mockStoreState,
  typeString,
  resetDOM,
  deferRequest,
  mapOf,
} from "../test-helpers";
import CatalogOverlay from "./catalog";

jest.mock("../api/api");

beforeEach(resetDOM);

const mockedRequest = mockedFunction(request);

test("create catalog first", async (): Promise<void> => {
  mockConsole();

  const store = mockStore(mockStoreState({}));
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let user = store.state.serverState.user!;

  user.hadCatalog = false;

  let { container } = render(<CatalogOverlay user={user}/>, store);

  let form = expectChild<HTMLFormElement>(container, "form.form");

  let title = expectChild(container, "#overlay-header .title");
  expect(title.textContent).toBe("catalog-create-title-first");

  form.submit();
  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  let nameInput = expectChild(container, "#catalog-overlay-name");
  typeString(nameInput, "New Catalog");

  let { call, resolve } = deferRequest<Api.Catalog, Api.CatalogCreateRequest>();

  form.submit();

  expect(await call).toEqual([Api.Method.CatalogCreate, {
    storage: "",
    name: "New Catalog",
  }]);

  await resolve({
    id: "catalog",
    name: "New Catalog",
  });

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "catalogCreated",
    payload: [{
      id: "catalog",
      name: "New Catalog",
      people: mapOf({}),
      tags: mapOf({}),
      albums: mapOf({}),
    }],
  });
});

test("create catalog", async (): Promise<void> => {
  const store = mockStore(mockStoreState({}));
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let user = store.state.serverState.user!;

  user.hadCatalog = true;

  let { container } = render(<CatalogOverlay user={user}/>, store);

  let title = expectChild(container, "#overlay-header .title");
  expect(title.textContent).toBe("catalog-create-title");

  let nameInput = expectChild(container, "#catalog-overlay-name");
  typeString(nameInput, "New Catalog");

  let { call, resolve } = deferRequest<Api.Catalog, Api.CatalogCreateRequest>();

  let form = expectChild<HTMLFormElement>(container, "form.form");
  form.submit();

  expect(await call).toEqual([Api.Method.CatalogCreate, {
    storage: "",
    name: "New Catalog",
  }]);

  await resolve({
    id: "catalog",
    name: "New Catalog",
  });

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "catalogCreated",
    payload: [{
      id: "catalog",
      name: "New Catalog",
      people: mapOf({}),
      tags: mapOf({}),
      albums: mapOf({}),
    }],
  });
});
