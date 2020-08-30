import { act, waitFor } from "@testing-library/react";
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
  click,
} from "../test-helpers";
import { ApiError } from "../utils/exception";
import SignupOverlay from "./signup";

jest.mock("../api/api");

const mockedRequest = mockedFunction(request);

afterEach(resetDOM);

test("signup success", async (): Promise<void> => {
  let store = mockStore(mockStoreState({}));

  let { dialogContainer } = render(<SignupOverlay/>, store);

  let form = expectChild<HTMLFormElement>(dialogContainer, "form");

  let email = expectChild<HTMLInputElement>(form, "#dialog-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let name = expectChild<HTMLInputElement>(form, "#dialog-fullname");
  expect(name.localName).toBe("input");
  expect(name.type).toBe("text");
  expect(name.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "#dialog-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  let button = expectChild<HTMLButtonElement>(form, "#dialog-submit");
  click(button);
  expect(store.dispatch).not.toHaveBeenCalled();

  let { resolve } = deferRequest<Api.State>();
  typeString(email, "foo@bar.com");
  typeString(name, "Bob Parr");
  typeString(password, "foopass");
  click(button);

  expect(store.dispatch).not.toHaveBeenCalled();

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(name.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Api.Method.Signup, {
    email: "foo@bar.com",
    password: "foopass",
    fullname: "Bob Parr",
  }]);

  let dispatchCall = awaitCall(store.dispatch);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  await act(() => resolve({
    user: {
      email: "foo@bar.com",
      fullname: "Bob Parr",
      hadCatalog: false,
      verified: true,
      catalogs: [],
      albums: [],
      people: [],
      tags: [],
    },
  }));

  let [deed] = await dispatchCall;

  expect(deed).toEqual({
    type: "completeSignup",
    payload: [{
      user: {
        email: "foo@bar.com",
        fullname: "Bob Parr",
        hadCatalog: false,
        verified: true,
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

  let email = expectChild<HTMLInputElement>(form, "input#dialog-email");
  expect(email.localName).toBe("input");
  expect(email.type).toBe("email");
  expect(email.disabled).toBeFalsy();

  let name = expectChild<HTMLInputElement>(form, "input#dialog-fullname");
  expect(name.localName).toBe("input");
  expect(name.type).toBe("text");
  expect(name.disabled).toBeFalsy();

  let password = expectChild<HTMLInputElement>(form, "input#dialog-password");
  expect(password.localName).toBe("input");
  expect(password.type).toBe("password");
  expect(password.disabled).toBeFalsy();

  let button = expectChild<HTMLButtonElement>(form, "#dialog-submit");
  click(button);
  expect(store.dispatch).not.toHaveBeenCalled();

  let { reject } = deferRequest();
  typeString(email, "foo@bar.com");
  click(button);

  expect(store.dispatch).not.toHaveBeenCalled();

  await waitFor((): void => {
    expect(email.disabled).toBeTruthy();
    expect(name.disabled).toBeTruthy();
    expect(password.disabled).toBeTruthy();
  });

  expect(mockedRequest).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedRequest)).toEqual([Api.Method.Signup, {
    email: "foo@bar.com",
    password: "",
    fullname: "",
  }]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  await act(() => reject(new ApiError(400, "Bad Request", {
    code: Api.ErrorCode.InvalidData,
    data: {},
  })));

  await waitFor((): void => {
    expect(email.disabled).toBeFalsy();
    expect(name.disabled).toBeFalsy();
    expect(password.disabled).toBeFalsy();
  });

  expect(store.dispatch).not.toHaveBeenCalled();

  let error = expectChild(dialogContainer, "#dialog-error");
  expect(error.textContent).toBe("api-error-invalid-data");
});
