import { act } from "@testing-library/react";
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
  click,
} from "../test-helpers";
import CatalogOverlay from "./catalog";

jest.mock("../api/api");

beforeEach(resetDOM);

const mockedRequest = mockedFunction(request);

test("create catalog", async (): Promise<void> => {
  mockConsole();

  const store = mockStore(mockStoreState({}));
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let user = store.state.serverState.user!;

  let { dialogContainer } = render(<CatalogOverlay user={user}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let button = expectChild(form, "#dialog-submit");
  click(button);

  expect(mockedRequest).not.toHaveBeenCalled();
  expect(store.dispatch).not.toHaveBeenCalled();

  let input = expectChild(form, "#dialog-catalogName");
  typeString(input, "New Catalog");
  input = expectChild(form, "#dialog-storageName");
  typeString(input, "Test storage");
  input = expectChild(form, "#dialog-accessKeyId");
  typeString(input, "Access");
  input = expectChild(form, "#dialog-secretAccessKey");
  typeString(input, "Secret");
  input = expectChild(form, "#dialog-region");
  typeString(input, "Region");
  input = expectChild(form, "#dialog-bucket");
  typeString(input, "Bucket");
  input = expectChild(form, "#dialog-endpoint");
  typeString(input, "Endpoint");
  input = expectChild(form, "#dialog-path");
  typeString(input, "Path");
  input = expectChild(form, "#dialog-publicUrl");
  typeString(input, "Public Url");

  let { call, resolve } = deferRequest<Api.Catalog, Api.CatalogCreateRequest>();

  click(button);

  expect(await call).toEqual([Api.Method.CatalogCreate, {
    storage: {
      name: "Test storage",
      accessKeyId: "Access",
      secretAccessKey: "Secret",
      region: "Region",
      bucket: "Bucket",
      path: "Path",
      endpoint: "Endpoint",
      publicUrl: "Public Url",
    },
    name: "New Catalog",
  }]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  await act(() => resolve({
    id: "catalog",
    name: "New Catalog",
    storage: "st",
  }));

  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "catalogCreated",
    payload: [{
      id: "catalog",
      name: "New Catalog",
      storage: "st",
      people: mapOf({}),
      tags: mapOf({}),
      albums: mapOf({}),
    }],
  });
});
