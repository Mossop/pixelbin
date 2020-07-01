import { waitFor, fireEvent } from "@testing-library/react";
import mockConsole from "jest-mock-console";
import React from "react";

import { lastCallArgs, mockedFunction } from "../../../test-helpers";
import request from "../api/request";
import { ApiMethod, CatalogData, CatalogCreateData } from "../api/types";
import {
  expect,
  render,
  expectChild,
  mockStore,
  mockStoreState,
  typeString,
  resetDOM,
  deferRequest,
} from "../test-helpers";
import CatalogOverlay from "./catalog";

jest.mock("../api/request");

beforeEach(resetDOM);

const mockedRequest = mockedFunction(request);

test("create catalog first", async (): Promise<void> => {
  mockConsole();

  const store = mockStore(mockStoreState({}));
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  let typeSelector = expectChild<HTMLSelectElement>(container, "#storage-config-type");
  expect(typeSelector.value).toBe("server");

  expect(typeSelector.parentElement?.nextElementSibling).toBeNull();

  let { call, resolve } = deferRequest<CatalogData, CatalogCreateData>();

  form.submit();

  expect(await call).toEqual([ApiMethod.CatalogCreate, {
    storage: {
      type: "server",
    },
    name: "New Catalog",
  }]);

  await waitFor((): void => {
    expect(typeSelector.disabled).toBeTruthy();
  });

  let catalog = {
    id: "catalog",
    name: "New Catalog",
    people: new Map(),
    tags: new Map(),
    albums: new Map(),
  };

  await resolve(catalog);

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "catalogCreated",
    payload: [catalog],
  });
});

test("create catalog", async (): Promise<void> => {
  const store = mockStore(mockStoreState({}));
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let user = store.state.serverState.user!;

  user.hadCatalog = true;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let { container } = render(<CatalogOverlay user={user}/>, store);

  let title = expectChild(container, "#overlay-header .title");
  expect(title.textContent).toBe("catalog-create-title");

  let nameInput = expectChild(container, "#catalog-overlay-name");
  typeString(nameInput, "New Catalog");

  let typeSelector = expectChild<HTMLSelectElement>(container, "#storage-config-type");
  expect(typeSelector.value).toBe("server");

  typeSelector.value = "backblaze";
  fireEvent.change(typeSelector);

  await waitFor((): void => {
    expectChild(container, "#backblaze-config-keyId");
  });

  typeString(expectChild<HTMLInputElement>(container, "#backblaze-config-keyId"), "test key id");
  typeString(expectChild<HTMLInputElement>(container, "#backblaze-config-key"), "test key");
  typeString(expectChild<HTMLInputElement>(container, "#backblaze-config-bucket"), "test bucket");
  typeString(expectChild<HTMLInputElement>(container, "#backblaze-config-path"), "/test/path");

  let { call, resolve } = deferRequest<CatalogData, CatalogCreateData>();

  let form = expectChild<HTMLFormElement>(container, "form.form");
  form.submit();

  expect(await call).toEqual([ApiMethod.CatalogCreate, {
    storage: {
      type: "backblaze",
      keyId: "test key id",
      key: "test key",
      bucket: "test bucket",
      path: "/test/path",
    },
    name: "New Catalog",
  }]);

  let catalog = {
    id: "catalog",
    name: "New Catalog",
    people: new Map(),
    tags: new Map(),
    albums: new Map(),
  };

  await resolve(catalog);

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "catalogCreated",
    payload: [catalog],
  });
});
