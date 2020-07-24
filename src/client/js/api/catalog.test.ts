/* eslint-disable @typescript-eslint/naming-convention */
import { mockedFunction } from "../../../test-helpers";
import fetch from "../environment/fetch";
import { expect } from "../test-helpers";
import {
  mockResponse,
  MockResponse,
  callInfo,
  CatalogDataResponse,
} from "../test-helpers/api";
import { createCatalog } from "./catalog";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Create catalog", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<CatalogDataResponse>(200, {
    id: "testcatalog",
    name: "Test catalog",
    people: [],
    tags: [],
    albums: [],
  }));

  let result = await createCatalog("Test catalog", {
    type: "server",
  });

  expect(result).toEqual({
    id: "testcatalog",
    name: "Test catalog",
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
      storage: {
        type: "server",
      },
    },
  });
});
