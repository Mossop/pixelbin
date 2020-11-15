import React from "react";

import type { Api } from "../../model";
import { Method } from "../../model";
import { awaitCall, mockedFunction } from "../../test-helpers";
import { request } from "../api/api";
import { OverlayType } from "../overlays/types";
import {
  expect,
  render,
  resetDOM,
  expectChild,
  click,
  mockStore,
  mockStoreState,
  mockServerState,
  Media,
} from "../test-helpers";
import Banner from "./Banner";

beforeEach(resetDOM);

jest.mock("../api/api");

test("banner", async (): Promise<void> => {
  Media.width = 300;

  let store = mockStore(mockStoreState({
    serverState: { user: null },
  }));

  let { container, unmount } = render(<Banner/>, store);
  let banner = expectChild(container, "header#appbar");

  let login = expectChild(banner, "button#button-login");
  expect(banner.querySelector("button#button-signup")).toBeNull();

  Media.width = 1024;
  // let signup = expectChild(banner, "button#button-signup");

  expect(store.dispatch).not.toHaveBeenCalled();

  click(login);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch.mock.calls[0]).toEqual([{
    type: "showOverlay",
    payload: [{
      type: OverlayType.Login,
    }],
  }]);
  store.dispatch.mockClear();

  // click(signup);
  // expect(store.dispatch).toHaveBeenCalledTimes(1);
  // expect(store.dispatch).toHaveBeenLastCalledWith({
  //   type: "showOverlay",
  //   payload: [{
  //     type: OverlayType.Signup,
  //   }],
  // });
  // store.dispatch.mockClear();

  unmount();

  let option1Click = jest.fn();
  let option2Click = jest.fn();
  store.state.serverState = mockServerState([]);
  container = render(<Banner
    pageOptions={
      [{
        id: "option1",
        label: "Label 1",
        icon: <div/>,
        onClick: option1Click,
      }, {
        id: "option2",
        label: "Label 2",
        icon: <div/>,
        onClick: option2Click,
      }]
    }
  />, store).container;
  banner = expectChild(container, "header#appbar");
  store.dispatch.mockClear();

  let logout = expectChild(document, "#user-menu li#user-menu-logout");

  expect(request).not.toHaveBeenCalled();

  let mockRequest = mockedFunction(request);
  mockRequest.mockImplementationOnce((): Api.State => ({
    user: null,
  }));

  let promise = awaitCall(store.dispatch);
  click(logout);
  await promise;

  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenLastCalledWith(Method.Logout);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "completeLogout",
    payload: [{
      user: null,
    }],
  });

  expect(document.querySelector("#pageoption-menu-option1")).toBeNull();
  let option1 = expectChild(container, "#pageoption-button-option1");
  expect(option1Click).not.toHaveBeenCalled();
  click(option1);
  expect(option1Click).toHaveBeenCalledTimes(1);
  option1Click.mockClear();

  expect(document.querySelector("#pageoption-menu-option2")).toBeNull();
  let option2 = expectChild(container, "#pageoption-button-option2");
  expect(option2Click).not.toHaveBeenCalled();
  click(option2);
  expect(option2Click).toHaveBeenCalledTimes(1);
  option2Click.mockClear();

  Media.width = 300;

  expect(document.querySelector("#pageoption-button-option1")).toBeNull();
  option1 = expectChild(document, "#page-options #pageoption-menu-option1");
  expect(option1Click).not.toHaveBeenCalled();
  click(option1);
  expect(option1Click).toHaveBeenCalledTimes(1);

  expect(document.querySelector("#pageoption-button-option2")).toBeNull();
  option2 = expectChild(document, "#page-options #pageoption-menu-option2");
  expect(option2Click).not.toHaveBeenCalled();
  click(option2);
  expect(option2Click).toHaveBeenCalledTimes(1);
});
