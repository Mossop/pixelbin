/* eslint-disable @typescript-eslint/naming-convention */
import { Method } from "../../model";
import { mockedFunction } from "../../test-helpers";
import fetch from "../environment/fetch";
import { expect } from "../test-helpers";
import { mockResponse, callInfo } from "../test-helpers/api";
import { createCatalog, createStorage, editCatalog } from "./catalog";
import { Catalog } from "./highlevel";

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

  let result = await createCatalog("str", {
    name: "Test catalog",
  });

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
      storage: "str",
      catalog: {
        name: "Test catalog",
      },
    },
  });
});

test("Edit catalog", async (): Promise<void> => {
  mockResponse(Method.CatalogEdit, 200, {
    id: "testcatalog",
    name: "Renamed catalog",
    storage: "str",
  });

  let result = await editCatalog(Catalog.ref("testcatalog"), {
    name: "Renamed catalog",
  });

  expect(result).toEqual({
    storage: "str",
    id: "testcatalog",
    name: "Renamed catalog",
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PATCH",
    path: "http://pixelbin/api/catalog/edit",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      id: "testcatalog",
      catalog: {
        name: "Renamed catalog",
      },
    },
  });
});