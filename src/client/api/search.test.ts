/* eslint-disable @typescript-eslint/naming-convention */
import type { Search } from "../../model";
import { Method, Operator } from "../../model";
import { mockedFunction } from "../../test-helpers";
import fetch from "../environment/fetch";
import { expect } from "../test-helpers";
import { mockResponse, callInfo } from "../test-helpers/api";
import { Catalog, SavedSearch } from "./highlevel";
import { createSavedSearch, editSavedSearch, deleteSavedSearches } from "./search";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Create saved search", async (): Promise<void> => {
  let query: Search.FieldQuery = {
    type: "field",
    field: "title",
    invert: false,
    modifier: null,
    operator: Operator.Equal,
    value: "foo",
  };

  mockResponse(Method.SavedSearchCreate, 200, {
    id: "testsearch",
    catalog: "testcatalog",
    name: "Test Search",
    // @ts-ignore
    query,
  });

  let result = await createSavedSearch(Catalog.ref("testcatalog"), query, "Test Search");

  expect(result).toEqual({
    id: "testsearch",
    name: "Test Search",
    catalog: expect.toBeRef("testcatalog"),
    query,
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/search/create",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      catalog: "testcatalog",
      name: "Test Search",
      query,
    },
  });
});

test("Edit saved search", async (): Promise<void> => {
  let query: Search.FieldQuery = {
    type: "field",
    field: "title",
    invert: false,
    modifier: null,
    operator: Operator.Equal,
    value: "foo",
  };

  mockResponse(Method.SavedSearchEdit, 200, {
    id: "testsearch",
    catalog: "testcatalog",
    name: "Edited Search",
    // @ts-ignore
    query,
  });

  let result = await editSavedSearch(SavedSearch.ref("testsearch"), {
    name: "Edited Search",
  });

  expect(result).toEqual({
    id: "testsearch",
    name: "Edited Search",
    catalog: expect.toBeRef("testcatalog"),
    query,
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PATCH",
    path: "http://pixelbin/api/search/edit",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      id: "testsearch",
      name: "Edited Search",
    },
  });
});

test("Delete saved search", async (): Promise<void> => {
  mockResponse(Method.SavedSearchDelete, 200, undefined);

  await deleteSavedSearches([
    "testsearch1",
    "testsearch2",
  ]);

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "DELETE",
    path: "http://pixelbin/api/search/delete",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: [
      "testsearch1",
      "testsearch2",
    ],
  });
});
