/* eslint-disable @typescript-eslint/naming-convention */
import { Method } from "../../model";
import { mockedFunction } from "../../test-helpers";
import fetch from "../environment/fetch";
import { expect } from "../test-helpers";
import { mockResponse, callInfo } from "../test-helpers/api";
import { createCatalog, createStorage } from "./catalog";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Create storage", async (): Promise<void> => {
  mockResponse(Method.StorageCreate, 200, {
    id: "teststorage",
    name: "Test catalog",
    endpoint: null,
    path: null,
    bucket: "bucket",
    region: "hello-1",
    publicUrl: null,
  });

  let result = await createStorage({
    accessKeyId: "myaccess",
    secretAccessKey: "mysecret",
    name: "Test catalog",
    endpoint: null,
    path: null,
    bucket: "bucket",
    region: "hello-1",
    publicUrl: null,
  });

  expect(result).toEqual({
    id: "teststorage",
    name: "Test catalog",
    endpoint: null,
    path: null,
    bucket: "bucket",
    region: "hello-1",
    publicUrl: null,
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/storage/create",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      accessKeyId: "myaccess",
      secretAccessKey: "mysecret",
      name: "Test catalog",
      endpoint: null,
      path: null,
      bucket: "bucket",
      region: "hello-1",
      publicUrl: null,
    },
  });
});

test("Create catalog", async (): Promise<void> => {
  mockResponse(Method.CatalogCreate, 200, {
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
    searches: new Map(),
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
