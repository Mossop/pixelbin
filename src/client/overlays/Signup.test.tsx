import { waitFor } from "@testing-library/react";
import React from "react";

import { Method, ErrorCode } from "../../model";
import { awaitCall, lastCallArgs, mockedFunction } from "../../test-helpers";
import { parseDateTime } from "../../utils";
import { request } from "../api/api";
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
} from "../test-helpers";
import { ApiError } from "../utils/exception";
import SignupOverlay from "./Signup";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("signup success", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { dialogContainer } = render(<SignupOverlay/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let email = expectChild<HTMLInputElement>(form, "#signup-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let name = expectChild<HTMLInputElement>(form, "#signup-fullname");
  expect(name.localName).toBe("input");
  expect(name.type).toBe("text");
  expect(name.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "#signup-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  let button = expectChild<HTMLButtonElement>(form, "#signup-submit");
  click(button);
  expect(store.dispatch).not.toHaveBeenCalled();

  let { resolve } = deferRequest<Method.Signup>();
  await typeString(email, "foo@bar.com");
  await typeString(name, "Bob Parr");
  await typeString(password, "foopass");
  click(button);

  expect(store.dispatch).not.toHaveBeenCalled();

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(name.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Method.Signup, {
    email: "foo@bar.com",
    password: "foopass",
    fullname: "Bob Parr",
  }]);

  let dispatchCall = awaitCall(store.dispatch);

  await resolve({
    user: {
      email: "foo@bar.com",
      fullname: "Bob Parr",
      administrator: false,
      created: parseDateTime("2019-05-06T12:34:56Z"),
      lastLogin: parseDateTime("2020-03-01T12:34:56Z"),
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      people: [],
      tags: [],
      searches: [],
    },
    apiHost: null,
  });

  let [deed] = await dispatchCall;

  expect(deed).toEqual({
    type: "completeSignup",
    payload: [{
      user: {
        email: "foo@bar.com",
        fullname: "Bob Parr",
        administrator: false,
        created: expect.toEqualDate("2019-05-06T12:34:56Z"),
        lastLogin: expect.toEqualDate("2020-03-01T12:34:56Z"),
        verified: true,
        storage: mapOf({}),
        catalogs: mapOf({}),
      },
    }],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();
});

test("signup failed", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { dialogContainer } = render(<SignupOverlay/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let email = expectChild<HTMLInputElement>(form, "input#signup-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let name = expectChild<HTMLInputElement>(form, "input#signup-fullname");
  expect(name.localName).toBe("input");
  expect(name.type).toBe("text");
  expect(name.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "input#signup-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  let button = expectChild<HTMLButtonElement>(form, "#signup-submit");
  click(button);
  expect(store.dispatch).not.toHaveBeenCalled();

  let { reject } = deferRequest();
  await typeString(email, "foo@bar.com");
  click(button);

  expect(store.dispatch).not.toHaveBeenCalled();

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(name.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Method.Signup, {
    email: "foo@bar.com",
    password: "",
    fullname: "",
  }]);

  await reject(new ApiError(400, "Bad Request", {
    code: ErrorCode.InvalidData,
    data: {},
  }));

  await waitFor((): void => {
    expect(email.disabled).toBeFalsy();
    expect(name.disabled).toBeFalsy();
    expect(password.disabled).toBeFalsy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  let error = expectChild(dialogContainer, "#signup-error");
  expect(error.textContent).toBe("api-error-invalid-data");
});
