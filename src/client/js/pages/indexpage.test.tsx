import React from "react";

import { mockedClass, lastCallArgs } from "../../../test-helpers";
import Banner from "../components/Banner";
import Sidebar from "../components/Sidebar";
import store from "../store";
import actions from "../store/actions";
import {
  expect,
  render,
  resetDOM,
  mockServerData,
} from "../test-helpers";
import Index from "./indexpage";

beforeEach(resetDOM);

jest.mock("../components/Banner", (): unknown => {
  return {
    __esModule: true,
    default: jest.fn((): null => null),
  };
});

jest.mock("../components/Sidebar", (): unknown => {
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
