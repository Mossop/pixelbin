import { awaitCall } from "pixelbin-test-helpers";
import React from "react";

import request from "../api/request";
import { ApiMethod } from "../api/types";
import {
  expect,
  render,
  resetDOM,
  expectChild,
  click,
  mockStore,
  mockStoreState,
  mockServerData,
} from "../test-helpers";
import Banner from "./Banner";

beforeEach(resetDOM);

jest.mock("./Button");
jest.mock("../api/request");

test("banner", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: { user: null },
  }));

  let { container } = render(<Banner/>, store);
  let banner = expectChild(container, "div#banner");

  let login = expectChild(banner, ".mock-button[data-l10nid='banner-login']");
  let signup = expectChild(banner, ".mock-button[data-l10nid='banner-signup']");

  expect(store.dispatch).not.toHaveBeenCalled();

  click(login);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch.mock.calls[0]).toEqual([{
    type: "showLoginOverlay",
    payload: [],
  }]);
  store.dispatch.mockClear();

  click(signup);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "showSignupOverlay",
    payload: [],
  });
  store.dispatch.mockClear();

  store.state.serverState = mockServerData([]);
  container = render(<Banner/>, store).container;
  banner = expectChild(container, "div#banner");
  store.dispatch.mockClear();

  let logout = expectChild(banner, ".mock-button[data-l10nid='banner-logout']");

  expect(request).not.toHaveBeenCalled();

  let promise = awaitCall(store.dispatch);
  click(logout);
  await promise;

  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenLastCalledWith(ApiMethod.Logout);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "completeLogout",
    payload: [undefined],
  });
});
