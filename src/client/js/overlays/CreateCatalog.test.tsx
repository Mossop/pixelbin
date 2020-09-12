import mockConsole from "jest-mock-console";
import React from "react";

import { Api } from "../../../model";
import { deferCall, lastCallArgs } from "../../../test-helpers";
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
  mockServerState,
} from "../test-helpers";
import { testStorageConfig } from "../utils/aws";
import CatalogOverlay from "./CreateCatalog";

jest.mock("../api/api");
jest.mock("../utils/aws", () => ({
  __esModule: true,
  testStorageConfig: jest.fn(),
}));

beforeEach(resetDOM);

test("create catalog", async (): Promise<void> => {
  mockConsole();

  const store = mockStore(mockStoreState({}));
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let user = store.state.serverState.user!;

  let { dialogContainer } = render(<CatalogOverlay user={user}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  expect(form.querySelector("#storage-existing")).toBeNull();

  let awsRadio = expectChild<HTMLInputElement>(form, "#storage-aws");
  let compatibleRadio = expectChild<HTMLInputElement>(form, "#storage-compatible");
  expect(awsRadio.checked).toBeTruthy();
  expect(compatibleRadio.checked).toBeFalsy();

  let backBtn = expectChild<HTMLButtonElement>(form, "#dialog-back");
  let nextBtn = expectChild<HTMLButtonElement>(form, "#dialog-next");

  expect(backBtn.disabled).toBeTruthy();
  expect(nextBtn.disabled).toBeFalsy();

  click(compatibleRadio);

  expect(awsRadio.checked).toBeFalsy();
  expect(compatibleRadio.checked).toBeTruthy();

  expect(backBtn.disabled).toBeTruthy();
  expect(nextBtn.disabled).toBeTruthy();

  let input = expectChild(form, "#dialog-endpoint");
  typeString(input, "http://localhost:9000");

  expect(backBtn.disabled).toBeTruthy();
  expect(nextBtn.disabled).toBeFalsy();

  click(nextBtn);

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  input = expectChild(form, "#dialog-storageName");
  typeString(input, "New storage");
  input = expectChild(form, "#dialog-accessKeyId");
  typeString(input, "Access key");
  input = expectChild(form, "#dialog-secretAccessKey");
  typeString(input, "Secret");
  input = expectChild(form, "#dialog-bucket");
  typeString(input, "Test bucket");

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeFalsy();

  input = expectChild(form, "#dialog-region");
  typeString(input, "us-west");
  input = expectChild(form, "#dialog-path");
  typeString(input, "foo/bar");

  let { call: badCall, reject: testReject } = deferCall(testStorageConfig);

  click(nextBtn);

  expect(form.querySelector("#storage-test-testing")).not.toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  expect(await badCall).toEqual([{
    name: "New storage",
    accessKeyId: "Access key",
    secretAccessKey: "Secret",
    region: "us-west",
    bucket: "Test bucket",
    path: "foo/bar",
    endpoint: "http://localhost:9000",
    publicUrl: null,
  }]);

  expect(form.querySelector("#storage-test-testing")).not.toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  await testReject({
    failure: "download",
    message: "bad",
  });

  expect(form.querySelector("#storage-test-testing")).toBeNull();
  expect(form.querySelector("#storage-test-failure")).not.toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  click(backBtn);

  let { call: goodCall, resolve: testResolve } = deferCall(testStorageConfig);

  click(nextBtn);

  expect(form.querySelector("#storage-test-testing")).not.toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  expect(await goodCall).toEqual([{
    name: "New storage",
    accessKeyId: "Access key",
    secretAccessKey: "Secret",
    region: "us-west",
    bucket: "Test bucket",
    path: "foo/bar",
    endpoint: "http://localhost:9000",
    publicUrl: null,
  }]);

  expect(form.querySelector("#storage-test-testing")).not.toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  await testResolve();

  expect(form.querySelector("#storage-test-testing")).toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).not.toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeFalsy();

  click(nextBtn);

  expect(backBtn.disabled).toBeFalsy();
  expect(form.querySelector("#dialog-next")).toBeNull();
  let submitBtn = expectChild<HTMLButtonElement>(form, "#dialog-submit");
  expect(submitBtn.disabled).toBeTruthy();

  input = expectChild(form, "#dialog-catalogName");
  typeString(input, "New catalog");

  expect(submitBtn.disabled).toBeFalsy();

  let { call, resolve } = deferRequest<Api.Storage, Api.StorageCreateRequest>();

  click(submitBtn);

  expect(await call).toEqual([Api.Method.StorageCreate, {
    name: "New storage",
    accessKeyId: "Access key",
    secretAccessKey: "Secret",
    region: "us-west",
    bucket: "Test bucket",
    path: "foo/bar",
    endpoint: "http://localhost:9000",
    publicUrl: null,
  }]);

  let {
    call: storageCall,
    resolve: storageResolve,
  } = deferRequest<Api.Catalog, Api.Create<Api.Catalog>>();

  expect(store.dispatch).not.toHaveBeenCalled();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  await resolve({
    id: "st123",
    name: "New storage",
    region: "us-west",
    bucket: "Test bucket",
    path: "foo/bar",
    endpoint: "http://localhost:9000",
    publicUrl: null,
  });

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "storageCreated",
    payload: [{
      id: "st123",
      name: "New storage",
      region: "us-west",
      bucket: "Test bucket",
      path: "foo/bar",
      endpoint: "http://localhost:9000",
      publicUrl: null,
    }],
  });

  store.dispatch.mockClear();

  expect(await storageCall).toEqual([Api.Method.CatalogCreate, {
    storage: "st123",
    name: "New catalog",
  }]);

  expect(store.dispatch).toHaveBeenCalledTimes(0);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  await storageResolve({
    id: "Cat356",
    storage: "st123",
    name: "New catalog",
  });

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "catalogCreated",
    payload: [{
      id: "Cat356",
      name: "New catalog",
      storage: "st123",
      people: mapOf({}),
      tags: mapOf({}),
      albums: mapOf({}),
    }],
  });
});

test("create catalog with existing storage", async (): Promise<void> => {
  mockConsole();

  const store = mockStore(mockStoreState({
    serverState: mockServerState([{
      storage: "st567",
      name: "Existing catalog",
    }]),
  }));
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let user = store.state.serverState.user!;

  let { dialogContainer } = render(<CatalogOverlay user={user}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let existingRadio = expectChild<HTMLInputElement>(form, "#storage-existing");
  let awsRadio = expectChild<HTMLInputElement>(form, "#storage-aws");
  let compatibleRadio = expectChild<HTMLInputElement>(form, "#storage-compatible");
  expect(existingRadio.checked).toBeTruthy();
  expect(awsRadio.checked).toBeFalsy();
  expect(compatibleRadio.checked).toBeFalsy();

  let field = expectChild(form, "#dialog-existingStorage");
  let select = expectChild<HTMLInputElement>(field.parentElement, ".MuiSelect-nativeInput");
  expect(select.value).toBe("st567");

  let backBtn = expectChild<HTMLButtonElement>(form, "#dialog-back");
  let nextBtn = expectChild<HTMLButtonElement>(form, "#dialog-next");

  expect(backBtn.disabled).toBeTruthy();
  expect(nextBtn.disabled).toBeFalsy();

  click(nextBtn);

  expect(backBtn.disabled).toBeFalsy();
  expect(form.querySelector("#dialog-next")).toBeNull();
  let submitBtn = expectChild<HTMLButtonElement>(form, "#dialog-submit");
  expect(submitBtn.disabled).toBeTruthy();

  let input = expectChild(form, "#dialog-catalogName");
  typeString(input, "New catalog");

  expect(submitBtn.disabled).toBeFalsy();

  let { call, resolve } = deferRequest<Api.Catalog, Api.Create<Api.Catalog>>();

  click(submitBtn);

  expect(await call).toEqual([Api.Method.CatalogCreate, {
    storage: "st567",
    name: "New catalog",
  }]);

  expect(store.dispatch).toHaveBeenCalledTimes(0);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  await resolve({
    id: "Cat356",
    storage: "st567",
    name: "New catalog",
  });

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "catalogCreated",
    payload: [{
      id: "Cat356",
      name: "New catalog",
      storage: "st567",
      people: mapOf({}),
      tags: mapOf({}),
      albums: mapOf({}),
    }],
  });
});
