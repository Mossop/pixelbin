/* eslint-disable @typescript-eslint/naming-convention */
import type { Search } from "../../model";
import { emptyMetadata, Method, Operator } from "../../model";
import { mockedFunction } from "../../test-helpers";
import fetch from "../environment/fetch";
import { expect, mockStore } from "../test-helpers";
import { mockResponse, callInfo } from "../test-helpers/api";
import { Catalog, SavedSearch } from "./highlevel";
import {
  createSavedSearch,
  editSavedSearch,
  deleteSavedSearch,
  getSharedSearchResults,
} from "./search";

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
    shared: true,
    // @ts-ignore
    query,
  });

  let result = await createSavedSearch(Catalog.ref("testcatalog"), {
    query,
    name: "Test Search",
    shared: true,
  });

  expect(result).toEqual({
    id: "testsearch",
    name: "Test Search",
    catalog: expect.toBeRef("testcatalog"),
    shared: true,
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
      search: {
        name: "Test Search",
        shared: true,
        query,
      },
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
    shared: true,
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
    shared: true,
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
      search: {
        name: "Edited Search",
      },
    },
  });
});

test("Delete saved search", async (): Promise<void> => {
  mockResponse(Method.SavedSearchDelete, 200, undefined);

  await deleteSavedSearch(SavedSearch.ref("testsearch1"));

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
    ],
  });
});

test("List public search", async (): Promise<void> => {
  mockStore();

  mockResponse(Method.SharedSearch, 200, {
    name: "My search",
    media: [{
      id: "foo",
      created: "2020-03-04T05:06:07Z",
      updated: "2020-03-04T05:06:07Z",
      ...emptyMetadata,
      file: {
        id: "test",
        uploaded: "2020-03-04T05:06:07Z",
        width: 200,
        height: 300,
        mimetype: "image/jpeg",
        fileSize: 2000,
        duration: null,
        frameRate: null,
        bitRate: null,
      },
    }],
  });

  let results = await getSharedSearchResults("testsearch");
  expect(results).toEqual({
    name: "My search",
    media: [{
      id: "foo",
      created: expect.toEqualDate("2020-03-04T05:06:07Z"),
      updated: expect.toEqualDate("2020-03-04T05:06:07Z"),
      ...emptyMetadata,
      file: {
        id: "test",
        uploaded: expect.toEqualDate("2020-03-04T05:06:07Z"),
        width: 200,
        height: 300,
        mimetype: "image/jpeg",
        fileSize: 2000,
        duration: null,
        frameRate: null,
        bitRate: null,
        encodings: [{
          mimetype: "image/jpeg",
          url: "/search/testsearch/media/foo/test/encoding/image-jpeg/image.jpg",
        }, {
          mimetype: "image/webp",
          url: "/search/testsearch/media/foo/test/encoding/image-webp/image.webp",
        }],
        thumbnails: [{
          mimetype: "image/jpeg",
          size: 100,
          url: "/search/testsearch/media/foo/test/thumb/100/image-jpeg/image.jpg",
        }, {
          mimetype: "image/jpeg",
          size: 200,
          url: "/search/testsearch/media/foo/test/thumb/200/image-jpeg/image.jpg",
        }, {
          mimetype: "image/webp",
          size: 100,
          url: "/search/testsearch/media/foo/test/thumb/100/image-webp/image.webp",
        }, {
          mimetype: "image/webp",
          size: 200,
          url: "/search/testsearch/media/foo/test/thumb/200/image-webp/image.webp",
        }],
        url: "/search/testsearch/media/foo/test/image.jpg",
        videoEncodings: [{
          mimetype: "video/mp4",
          url: "/search/testsearch/media/foo/test/encoding/video-mp4/video.mp4",
        }],
      },
    }],
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "GET",
    path: "http://pixelbin/api/search/shared?id=testsearch",
    headers: {
      "X-CSRFToken": "csrf-foobar",
    },
  });
});
