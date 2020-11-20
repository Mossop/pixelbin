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
import LoginOverlay from "./Login";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("login success", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { dialogContainer } = render(<LoginOverlay/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let email = expectChild<HTMLInputElement>(form, "input#login-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "input#login-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  let button = expectChild<HTMLButtonElement>(form, "button#login-submit");
  click(button);
  expect(store.dispatch).not.toHaveBeenCalled();

  let { resolve } = deferRequest<Method.Login>();
  await typeString(email, "foo@bar.com");
  click(button);

  expect(store.dispatch).not.toHaveBeenCalled();

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Method.Login, {
    email: "foo@bar.com",
    password: "",
  }]);

  let dispatchCall = awaitCall(store.dispatch);
  let created = parseDateTime("2016-05-23T14:56:32Z");

  await resolve({
    user: {
      email: "foo@bar.com",
      fullname: "Someone",
      administrator: false,
      created,
      lastLogin: created,
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
      searches: [],
    },
  });

  let [deed] = await dispatchCall;

  expect(deed).toEqual({
    type: "completeLogin",
    payload: [{
      user: {
        email: "foo@bar.com",
        fullname: "Someone",
        administrator: false,
        created: expect.toEqualDate(created),
        lastLogin: expect.toEqualDate(created),
        verified: true,
        storage: mapOf({}),
        catalogs: mapOf({}),
      },
    }],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();
});

test("login failed", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { dialogContainer } = render(<LoginOverlay/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let email = expectChild<HTMLInputElement>(form, "input#login-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "input#login-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  await typeString(email, "foo@bar.com");
  await typeString(password, "foopass");

  let { reject } = deferRequest();

  let button = expectChild<HTMLButtonElement>(form, "button#login-submit");
  click(button);

  expect(store.dispatch).not.toHaveBeenCalled();
  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Method.Login, {
    email: "foo@bar.com",
    password: "foopass",
  }]);

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  await reject(new ApiError(403, "Not Authorized", {
    code: ErrorCode.LoginFailed,
    data: {},
  }));

  await waitFor((): void => {
    expect(email.disabled).toBeFalsy();
    expect(password.disabled).toBeFalsy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  let error = expectChild(dialogContainer, "#login-error");
  expect(error.textContent).toBe("api-error-login-failed");
});
