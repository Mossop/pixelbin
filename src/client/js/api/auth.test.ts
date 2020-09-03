/* eslint-disable @typescript-eslint/naming-convention */
import { Api } from "../../../model";
import { mockedFunction } from "../../../test-helpers";
import fetch from "../environment/fetch";
import { expect, mapOf } from "../test-helpers";
import {
  mockResponse,
  MockResponse,
  callInfo,
} from "../test-helpers/api";
import { ErrorCode } from "../utils/exception";
import { state, login, logout, signup } from "./auth";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Bad state", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<Api.Album>(200, {
    id: "album",
    catalog: "catalog",
    name: "Album",
    parent: null,
  }));

  await expect(state()).rejects.toBeAppError(ErrorCode.DecodeError);
});

test("Get state", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<Api.State>(200, {
    user: null,
  }));

  let result = await state();

  expect(result).toEqual({
    user: null,
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "GET",
    path: "http://pixelbin/api/state",
    headers: {
      "X-CSRFToken": "csrf-foobar",
    },
  });
});

test("Login", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<Api.State>(200, {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      created: "2019-02-03T06:08:12Z",
      verified: true,
      catalogs: [{
        id: "cat1",
        name: "Catalog 1",
      }],
      people: [{
        id: "person1",
        name: "Person 1",
        catalog: "cat1",
      }, {
        id: "person2",
        name: "Person 2",
        catalog: "cat1",
      }],
      tags: [{
        id: "tag1",
        name: "top",
        catalog: "cat1",
        parent: null,
      }],
      albums: [{
        id: "album1",
        name: "Album 1",
        catalog: "cat1",
        parent: null,
      }],
    },
  }));

  let result = await login("user", "pass");

  expect(result).toEqual({
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      created: expect.toEqualDate("2019-02-03T06:08:12Z"),
      verified: true,
      catalogs: mapOf({
        cat1: {
          id: "cat1",
          name: "Catalog 1",
          people: mapOf({
            person1: {
              id: "person1",
              name: "Person 1",
              catalog: expect.toBeRef("cat1"),
            },
            person2: {
              id: "person2",
              name: "Person 2",
              catalog: expect.toBeRef("cat1"),
            },
          }),
          tags: mapOf({
            tag1: {
              id: "tag1",
              name: "top",
              catalog: expect.toBeRef("cat1"),
              parent: null,
            },
          }),
          albums: mapOf({
            album1: {
              id: "album1",
              name: "Album 1",
              catalog: expect.toBeRef("cat1"),
              parent: null,
            },
          }),
        },
      }),
    },
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "POST",
    path: "http://pixelbin/api/login",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: {
      email: "user",
      password: "pass",
    },
  });
});

test("Logout", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<Api.State>(200, {
    user: null,
  }));

  let result = await logout();

  expect(result).toEqual({
    user: null,
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "POST",
    path: "http://pixelbin/api/logout",
    headers: {
      "X-CSRFToken": "csrf-foobar",
    },
  });
});

test("Signup", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<Api.State>(200, {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      created: "2015-12-25T06:00:00Z",
      verified: true,
      catalogs: [],
      people: [],
      tags: [],
      albums: [],
    },
  }));

  let result = await signup({
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    password: "foobar67",
  });

  expect(result).toEqual({
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      created: expect.toEqualDate("2015-12-25T06:00:00Z"),
      verified: true,
      catalogs: mapOf({}),
    },
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/signup",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      password: "foobar67",
    },
  });
});
