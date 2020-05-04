import React from "react";

import Banner from "../../js/components/Banner";
import Sidebar from "../../js/components/Sidebar";
import Index from "../../js/pages/indexpage";
import store from "../../js/store";
import actions from "../../js/store/actions";
import { expect, render, resetDOM, mockedClass, lastCallArgs, mockServerData } from "../helpers";

beforeEach(resetDOM);

jest.mock("../../js/components/Banner", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("../../js/components/Sidebar", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

const mockedSidebar = mockedClass(Sidebar);
const mockedBanner = mockedClass(Banner);

test("not logged in", (): void => {
  store.dispatch(actions.updateServerState({ user: null }));

  render(<Index/>);

  expect(mockedSidebar).not.toHaveBeenCalled();
  expect(mockedBanner).toHaveBeenCalled();

  expect(lastCallArgs(mockedBanner)[0]).toEqual({
    children: null,
  });
});

test("logged in", (): void => {
  store.dispatch(actions.updateServerState(mockServerData([])));

  render(<Index/>);

  expect(mockedSidebar).toHaveBeenCalled();
  expect(mockedBanner).toHaveBeenCalled();

  expect(lastCallArgs(mockedSidebar)[0]).toEqual({});

  expect(lastCallArgs(mockedBanner)[0]).toEqual({
    children: null,
  });
});
