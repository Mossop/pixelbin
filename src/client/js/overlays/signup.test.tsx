import { waitFor } from "@testing-library/react";
import React from "react";

import { awaitCall, lastCallArgs, mockedFunction } from "../../../test-helpers";
import request from "../api/request";
import { ApiMethod, ApiErrorCode } from "../api/types";
import {
  expect,
  render,
  expectChild,
  mockStore,
  mockStoreState,
  typeString,
  resetDOM,
  deferRequest,
} from "../test-helpers";
import { ApiError } from "../utils/exception";
import SignupOverlay from "./signup";

jest.mock("../api/request");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("signup success", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { container } = render(<SignupOverlay/>, store);

  let form = expectChild<HTMLFormElement>(container, "form.form");

  let email = expectChild<HTMLInputElement>(form, "#signup-overlay-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let name = expectChild<HTMLInputElement>(form, "#signup-overlay-name");
  expect(name.localName).toBe("input");
  expect(name.type).toBe("text");
  expect(name.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "#signup-overlay-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  form.submit();
  expect(store.dispatch).not.toHaveBeenCalled();

  let { resolve } = deferRequest();
  typeString(email, "foo@bar.com");
  typeString(name, "Bob Parr");
  typeString(password, "foopass");
  form.submit();

  expect(store.dispatch).not.toHaveBeenCalled();

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(name.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([ApiMethod.UserCreate, {
    email: "foo@bar.com",
    password: "foopass",
    fullname: "Bob Parr",
  }]);

  void resolve();

  let [deed] = await awaitCall(store.dispatch);

  expect(deed).toEqual({
    type: "completeSignup",
    payload: [undefined],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();
});

test("signup failed", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { container } = render(<SignupOverlay/>, store);

  let form = expectChild<HTMLFormElement>(container, "form.form");

  let email = expectChild<HTMLInputElement>(form, "#signup-overlay-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let name = expectChild<HTMLInputElement>(form, "#signup-overlay-name");
  expect(name.localName).toBe("input");
  expect(name.type).toBe("text");
  expect(name.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "#signup-overlay-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  form.submit();
  expect(store.dispatch).not.toHaveBeenCalled();

  let { reject } = deferRequest();
  typeString(email, "foo@bar.com");
  form.submit();

  expect(store.dispatch).not.toHaveBeenCalled();

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(name.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([ApiMethod.UserCreate, {
    email: "foo@bar.com",
    password: "",
    fullname: "",
  }]);

  void reject(new ApiError(400, "Bad Request", {
    code: ApiErrorCode.SignupBadEmail,
    args: {},
  }));

  await waitFor((): void => {
    expect(email.disabled).toBeFalsy();
    expect(name.disabled).toBeFalsy();
    expect(password.disabled).toBeFalsy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  let error = expectChild(container, "#overlay-error");
  expect(error.textContent).toBe("api-error-signup-bad-email");
});
