import { act } from "@testing-library/react";

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
    <Page title="My title"/>,
    store,
  );

  expect(document.title).toBe("My title");
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
      title="Another title"
      pageOptions={
        [{
          id: "option1",
          icon: <div/>,
          label: "Option 1",
          onClick: option1Click,
        }]
      }
    />,
    store,
  );

  expect(document.title).toBe("Another title");

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
