/* eslint-disable @typescript-eslint/naming-convention */
import { Api } from "../../../model";
import { mockedFunction } from "../../../test-helpers";
import fetch from "../environment/fetch";
import { expect } from "../test-helpers";
import { mockResponse, callInfo } from "../test-helpers/api";
import { createCatalog } from "./catalog";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Create catalog", async (): Promise<void> => {
  mockResponse(Api.Method.CatalogCreate, 200, {
    id: "testcatalog",
    name: "Test catalog",
    storage: "str",
  });

  let result = await createCatalog("Test catalog", "str");

  expect(result).toEqual({
    id: "testcatalog",
    name: "Test catalog",
    storage: "str",
    people: new Map(),
    tags: new Map(),
    albums: new Map(),
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/catalog/create",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      name: "Test catalog",
      storage: "str",
    },
  });
});