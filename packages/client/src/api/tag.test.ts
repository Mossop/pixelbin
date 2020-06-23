import { mockedFunction } from "pixelbin-test-helpers";

import fetch from "../environment/fetch";
import { expect } from "../test-helpers";
import {
  mockResponse,
  MockResponse,
  callInfo,
  TagDataResponse,
} from "../test-helpers/api";
import { Catalog } from "./highlevel";
import { findTag } from "./tag";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Create tag", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<TagDataResponse[]>(200, [{
    id: "tag1",
    catalog: "testcatalog",
    name: "foo",
    parent: null,
  }, {
    id: "tag2",
    catalog: "testcatalog",
    name: "bar",
    parent: "tag1",
  }]));

  let result = await findTag(Catalog.ref("testcatalog"), ["foo", "bar"]);

  expect(result).toEqual([{
    id: "tag1",
    catalog: expect.toBeRef("testcatalog"),
    name: "foo",
    parent: null,
  }, {
    id: "tag2",
    catalog: expect.toBeRef("testcatalog"),
    name: "bar",
    parent: expect.toBeRef("tag1"),
  }]);

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "POST",
    path: "http://pixelbin/api/tag/find",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      catalog: "testcatalog",
      path: ["foo", "bar"],
    },
  });
});
