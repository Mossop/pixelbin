import { Catalog } from "../../js/api/highlevel";
import { createPerson } from "../../js/api/person";
import fetch from "../../js/environment/fetch";
import { expect, mockedFunction } from "../helpers";
import {
  mockResponse,
  MockResponse,
  callInfo,
  PersonDataResponse,
} from "../helpers/api";

jest.mock("../../js/environment/fetch");

const mockedFetch = mockedFunction(fetch);

beforeEach((): void => {
  mockedFetch.mockClear();
});

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
