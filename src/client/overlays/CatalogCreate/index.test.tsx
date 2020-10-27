import React from "react";

import CatalogOverlay from ".";
import { Api, AWSResult, Method } from "../../../model";
import { lastCallArgs } from "../../../test-helpers";
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
} from "../../test-helpers";

jest.mock("../../api/api");

beforeEach(resetDOM);

test("create catalog", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let user = store.state.serverState.user!;

  let { dialogContainer } = render(<CatalogOverlay user={user}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  expect(form.querySelector("#storage-existing")).toBeNull();

  let awsRadio = expectChild<HTMLInputElement>(form, "#storage-type-aws");
  let compatibleRadio = expectChild<HTMLInputElement>(form, "#storage-type-compatible");
  expect(awsRadio.checked).toBeTruthy();
  expect(compatibleRadio.checked).toBeFalsy();

  let backBtn = expectChild<HTMLButtonElement>(form, "#stepped-dialog-back");
  let nextBtn = expectChild<HTMLButtonElement>(form, "#stepped-dialog-next");

  expect(backBtn.disabled).toBeTruthy();
  expect(nextBtn.disabled).toBeFalsy();

  click(compatibleRadio);

  expect(awsRadio.checked).toBeFalsy();
  expect(compatibleRadio.checked).toBeTruthy();

  expect(backBtn.disabled).toBeTruthy();
  expect(nextBtn.disabled).toBeTruthy();

  let input = expectChild(form, "#storage-endpoint");
  typeString(input, "http://localhost:9000");

  expect(backBtn.disabled).toBeTruthy();
  expect(nextBtn.disabled).toBeFalsy();

  click(nextBtn);

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  input = expectChild(form, "#storage-name");
  typeString(input, "New storage");
  input = expectChild(form, "#storage-access-key");
  typeString(input, "Access key");
  input = expectChild(form, "#storage-secret-key");
  typeString(input, "Secret");
  input = expectChild(form, "#storage-bucket");
  typeString(input, "Test bucket");
  input = expectChild(form, "#storage-region");
  typeString(input, "hell-circle5-001");

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeFalsy();

  input = expectChild(form, "#storage-path");
  typeString(input, "foo/bar");

  let {
    call: badCall,
    resolve: badResolve,
  } = deferRequest<Api.StorageTestResult, Api.StorageTestRequest>();

  click(nextBtn);

  expect(form.querySelector("#storage-test-testing")).not.toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  expect(await badCall).toEqual([Method.StorageTest, {
    accessKeyId: "Access key",
    secretAccessKey: "Secret",
    bucket: "Test bucket",
    region: "hell-circle5-001",
    path: "foo/bar",
    endpoint: "http://localhost:9000",
    publicUrl: null,
  }]);

  expect(form.querySelector("#storage-test-testing")).not.toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  await badResolve({
    result: AWSResult.DownloadFailure,
    message: "bad result",
  });

  expect(form.querySelector("#storage-test-testing")).toBeNull();
  expect(form.querySelector("#storage-test-failure")).not.toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  let result = expectChild(form, "#storage-test-result");
  expect(result.textContent).toBe("aws-download-failure");
  let message = expectChild(form, "#storage-failure-message");
  expect(message.textContent).toBe("bad result");

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  click(backBtn);

  let {
    call: goodCall,
    resolve: goodResolve,
  } = deferRequest<Api.StorageTestResult, Api.StorageTestRequest>();

  click(nextBtn);

  expect(form.querySelector("#storage-test-testing")).not.toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  expect(await goodCall).toEqual([Method.StorageTest, {
    accessKeyId: "Access key",
    secretAccessKey: "Secret",
    bucket: "Test bucket",
    region: "hell-circle5-001",
    path: "foo/bar",
    endpoint: "http://localhost:9000",
    publicUrl: null,
  }]);

  expect(form.querySelector("#storage-test-testing")).not.toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).toBeNull();

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeTruthy();

  await goodResolve({
    result: AWSResult.Success,
    message: null,
  });

  expect(form.querySelector("#storage-test-testing")).toBeNull();
  expect(form.querySelector("#storage-test-failure")).toBeNull();
  expect(form.querySelector("#storage-test-success")).not.toBeNull();

  result = expectChild(form, "#storage-test-result");
  expect(result.textContent).toBe("storage-test-success");

  expect(backBtn.disabled).toBeFalsy();
  expect(nextBtn.disabled).toBeFalsy();

  click(nextBtn);

  expect(backBtn.disabled).toBeFalsy();
  expect(form.querySelector("#stepped-dialog-next")).toBeNull();
  let submitBtn = expectChild<HTMLButtonElement>(form, "#stepped-dialog-submit");
  expect(submitBtn.disabled).toBeTruthy();

  input = expectChild(form, "#catalog-name");
  typeString(input, "New catalog");

  expect(submitBtn.disabled).toBeFalsy();

  let { call, resolve } = deferRequest<Api.Storage, Api.StorageCreateRequest>();

  click(submitBtn);

  expect(await call).toEqual([Method.StorageCreate, {
    name: "New storage",
    accessKeyId: "Access key",
    secretAccessKey: "Secret",
    bucket: "Test bucket",
    region: "hell-circle5-001",
    path: "foo/bar",
    endpoint: "http://localhost:9000",
    publicUrl: null,
  }]);

  let {
    call: storageCall,
    resolve: storageResolve,
  } = deferRequest<Api.Catalog, Api.Create<Api.Catalog>>();

  expect(store.dispatch).not.toHaveBeenCalled();

  await resolve({
    id: "st123",
    name: "New storage",
    bucket: "Test bucket",
    region: "hell-circle5-001",
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
      bucket: "Test bucket",
      region: "hell-circle5-001",
      path: "foo/bar",
      endpoint: "http://localhost:9000",
      publicUrl: null,
    }],
  });

  store.dispatch.mockClear();

  expect(await storageCall).toEqual([Method.CatalogCreate, {
    storage: "st123",
    name: "New catalog",
  }]);

  expect(store.dispatch).toHaveBeenCalledTimes(0);

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
      searches: mapOf({}),
    }],
  });
});

test("create catalog with existing storage", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      storage: "st567",
      name: "Existing catalog",
    }]),
  }));
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  let user = store.state.serverState.user!;

  let { dialogContainer } = render(<CatalogOverlay user={user}/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let existingRadio = expectChild<HTMLInputElement>(form, "#storage-type-existing");
  let awsRadio = expectChild<HTMLInputElement>(form, "#storage-type-aws");
  let compatibleRadio = expectChild<HTMLInputElement>(form, "#storage-type-compatible");
  expect(existingRadio.checked).toBeTruthy();
  expect(awsRadio.checked).toBeFalsy();
  expect(compatibleRadio.checked).toBeFalsy();

  let field = expectChild(form, "#catalog-existingStorage");
  let select = expectChild<HTMLInputElement>(field.parentElement, ".MuiSelect-nativeInput");
  expect(select.value).toBe("st567");

  let backBtn = expectChild<HTMLButtonElement>(form, "#stepped-dialog-back");
  let nextBtn = expectChild<HTMLButtonElement>(form, "#stepped-dialog-next");

  expect(backBtn.disabled).toBeTruthy();
  expect(nextBtn.disabled).toBeFalsy();

  click(nextBtn);

  expect(backBtn.disabled).toBeFalsy();
  expect(form.querySelector("#stepped-dialog-next")).toBeNull();
  let submitBtn = expectChild<HTMLButtonElement>(form, "#stepped-dialog-submit");
  expect(submitBtn.disabled).toBeTruthy();

  let input = expectChild(form, "#catalog-name");
  typeString(input, "New catalog");

  expect(submitBtn.disabled).toBeFalsy();

  let { call, resolve } = deferRequest<Api.Catalog, Api.Create<Api.Catalog>>();

  click(submitBtn);

  expect(await call).toEqual([Method.CatalogCreate, {
    storage: "st567",
    name: "New catalog",
  }]);

  expect(store.dispatch).toHaveBeenCalledTimes(0);

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
      searches: mapOf({}),
    }],
  });
});
