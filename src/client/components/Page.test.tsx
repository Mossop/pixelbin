import { act } from "@testing-library/react";
import React from "react";

import {
  click,
  expectChild,
  Media,
  mockServerState,
  mockStore,
  mockStoreState,
  render,
  resetDOM,
} from "../test-helpers";
import Page from "./Page";

jest.useFakeTimers();

beforeAll(resetDOM);

test("page and sidebar", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: {
      user: null,
    },
  }));

  let { unmount } = render(
    <Page/>,
    store,
  );

  expect(document.querySelector("#sidebar-persistent")).toBeNull();
  expect(document.querySelector("#sidebar-modal")).toBeNull();
  expect(document.querySelector("#menu-button")).toBeNull();

  unmount();

  store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog",
      name: "Catalog",
      albums: [{
        id: "album1",
        name: "Album",
      }, {
        id: "album2",
        name: "Album 2",
      }],
    }]),
  }));

  let option1Click = jest.fn();
  render(
    <Page
      pageOptions={
        [{
          id: "option1",
          label: "Option 1",
          onClick: option1Click,
        }]
      }
    />,
    store,
  );

  let sidebar = expectChild(document, "#sidebar-persistent");
  expect(document.querySelector("#sidebar-modal")).toBeNull();
  expectChild(sidebar, "#sidebar-tree");
  expect(document.querySelector("#menu-button")).toBeNull();

  Media.width = 300;
  expect(document.querySelector("#sidebar-persistent")).toBeNull();
  expect(document.querySelector("#sidebar-modal")).toBeNull();

  let menuButton = expectChild(document, "#menu-button");
  click(menuButton);

  sidebar = expectChild(document, "#sidebar-modal");
  expectChild(sidebar, "#sidebar-tree");

  let button = expectChild(sidebar, "#sidebar-close");
  click(button);

  act(() => jest.runOnlyPendingTimers());

  expect(document.querySelector("#sidebar-modal")).toBeNull();
});
