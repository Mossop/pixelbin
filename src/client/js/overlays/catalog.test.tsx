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

  let input = expectChild(container, "#catalog-overlay-catalog-name");
  typeString(input, "New Catalog");
  input = expectChild(container, "#catalog-overlay-storage-name");
  typeString(input, "Test storage");
  input = expectChild(container, "#catalog-overlay-storage-access-key");
  typeString(input, "Access");
  input = expectChild(container, "#catalog-overlay-storage-secret-key");
  typeString(input, "Secret");
  input = expectChild(container, "#catalog-overlay-storage-region");
  typeString(input, "Region");
  input = expectChild(container, "#catalog-overlay-storage-bucket");
  typeString(input, "Bucket");

  let { call, resolve } = deferRequest<Api.Catalog, Api.CatalogCreateRequest>();

  form.submit();

  expect(await call).toEqual([Api.Method.CatalogCreate, {
    storage: {
      name: "Test storage",
      accessKeyId: "Access",
      secretAccessKey: "Secret",
      region: "Region",
      bucket: "Bucket",
      path: null,
      endpoint: null,
      publicUrl: null,
    },
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

  let input = expectChild(container, "#catalog-overlay-catalog-name");
  typeString(input, "New Catalog");
  input = expectChild(container, "#catalog-overlay-storage-name");
  typeString(input, "Test storage");
  input = expectChild(container, "#catalog-overlay-storage-access-key");
  typeString(input, "Access key");
  input = expectChild(container, "#catalog-overlay-storage-secret-key");
  typeString(input, "Secret key");
  input = expectChild(container, "#catalog-overlay-storage-region");
  typeString(input, "My region");
  input = expectChild(container, "#catalog-overlay-storage-bucket");
  typeString(input, "My bucket");
  input = expectChild(container, "#catalog-overlay-storage-endpoint");
  typeString(input, "My endpoint");

  let { call, resolve } = deferRequest<Api.Catalog, Api.CatalogCreateRequest>();

  let form = expectChild<HTMLFormElement>(container, "form.form");
  form.submit();

  expect(await call).toEqual([Api.Method.CatalogCreate, {
    storage: {
      name: "Test storage",
      accessKeyId: "Access key",
      secretAccessKey: "Secret key",
      region: "My region",
      bucket: "My bucket",
      path: null,
      endpoint: "My endpoint",
      publicUrl: null,
    },
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
