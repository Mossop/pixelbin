import { waitFor } from "@testing-library/react";
import React from "react";

import { Api } from "../../../model";
import { awaitCall, lastCallArgs, mockedFunction } from "../../../test-helpers";
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
} from "../test-helpers";
import { ApiError } from "../utils/exception";
import LoginOverlay from "./login";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("login success", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { container } = render(<LoginOverlay/>, store);

  let form = expectChild<HTMLFormElement>(container, "form.form");

  let email = expectChild<HTMLInputElement>(form, "#login-overlay-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "#login-overlay-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  form.submit();
  expect(store.dispatch).not.toHaveBeenCalled();

  let { resolve } = deferRequest<Api.State>();
  typeString(email, "foo@bar.com");
  form.submit();

  expect(store.dispatch).not.toHaveBeenCalled();

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Api.Method.Login, {
    email: "foo@bar.com",
    password: "",
  }]);

  void resolve({
    user: {
      email: "foo@bar.com",
      fullname: "Someone",
      hadCatalog: true,
      verified: true,
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
    },
  });

  let [deed] = await awaitCall(store.dispatch);

  expect(deed).toEqual({
    type: "completeLogin",
    payload: [{
      user: {
        email: "foo@bar.com",
        fullname: "Someone",
        hadCatalog: true,
        verified: true,
        catalogs: mapOf({}),
      },
    }],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();
});

test("login failed", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { container } = render(<LoginOverlay/>, store);

  let form = expectChild<HTMLFormElement>(container, "form.form");

  let email = expectChild<HTMLInputElement>(form, "#login-overlay-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "#login-overlay-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  typeString(email, "foo@bar.com");
  typeString(password, "foopass");

  let { reject } = deferRequest();

  form.submit();

  expect(store.dispatch).not.toHaveBeenCalled();
  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Api.Method.Login, {
    email: "foo@bar.com",
    password: "foopass",
  }]);

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  void reject(new ApiError(403, "Not Authorized", {
    code: Api.ErrorCode.LoginFailed,
    data: {},
  }));

  await waitFor((): void => {
    expect(email.disabled).toBeFalsy();
    expect(password.disabled).toBeFalsy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  let error = expectChild(container, "#overlay-error");
  expect(error.textContent).toBe("api-error-login-failed");
});
