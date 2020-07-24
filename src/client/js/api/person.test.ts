/* eslint-disable @typescript-eslint/naming-convention */
import { mockedFunction } from "../../../test-helpers";
import fetch from "../environment/fetch";
import { expect } from "../test-helpers";
import {
  mockResponse,
  MockResponse,
  callInfo,
  PersonDataResponse,
} from "../test-helpers/api";
import { Catalog } from "./highlevel";
import { createPerson } from "./person";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Create person", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<PersonDataResponse>(200, {
    id: "testperson",
    catalog: "testcatalog",
    name: "Test Person",
  }));

  let result = await createPerson(Catalog.ref("testcatalog"), "Test Person");

  expect(result).toEqual({
    id: "testperson",
    name: "Test Person",
    catalog: expect.toBeRef("testcatalog"),
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/person/create",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      catalog: "testcatalog",
      name: "Test Person",
    },
  });
});
