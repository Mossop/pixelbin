import React from "react";

import request from "../api/request";
import { ApiMethod, ApiErrorCode } from "../api/types";
import {
  expect,
  render,
  expectChild,
  mockStore,
  mockStoreState,
  typeString,
  submit,
  awaitCall,
  lastCallArgs,
  mockedFunction,
  after,
} from "../test-helpers";
import { ApiError } from "../utils/exception";
import LoginOverlay from "./login";

jest.mock("../api/request");
jest.mock("../l10n/localized");

const mockedRequest = mockedFunction(request);

test("login", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { container } = render(<LoginOverlay/>, store);

  let form = expectChild(container, "form.form");

  let email = expectChild(form, "#login-overlay-email");
  expect(email.localName).toBe("input");
  expect(email.getAttribute("type")).toBe("email");
  expect(email.hasAttribute("disabled")).toBeFalsy();

  let password = expectChild(form, "#login-overlay-password");
  expect(password.localName).toBe("input");
  expect(password.getAttribute("type")).toBe("password");
  expect(password.hasAttribute("disabled")).toBeFalsy();

  submit(form);
  expect(store.dispatch).not.toHaveBeenCalled();

  typeString(email, "foo@bar.com");
  submit(form);

  let [deed] = await awaitCall(store.dispatch);

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([ApiMethod.Login, {
    email: "foo@bar.com",
    password: "",
  }]);

  expect(deed).toEqual({
    type: "completeLogin",
    payload: [undefined],
  });

  mockedRequest.mockClear();
  store.dispatch.mockClear();

  let apiFailure = Promise.reject(new ApiError(403, "Not Authorized", {
    code: ApiErrorCode.LoginFailed,
    args: {},
  }));

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  mockedRequest.mockImplementationOnce(() => {
    return apiFailure;
  });

  typeString(password, "foopass");
  submit(form);

  await after(apiFailure);

  expect(store.dispatch).not.toHaveBeenCalled();
  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([ApiMethod.Login, {
    email: "foo@bar.com",
    password: "foopass",
  }]);

  expectChild(container, ".mock-localized[data-l10nid='api-error-login-failed'] #overlay-error");
});
