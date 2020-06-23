import { mockedClass, lastCallArgs } from "pixelbin-test-helpers";
import React from "react";

import { Catalog } from "../api/highlevel";
import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerData,
  expectChild,
  click,
} from "../test-helpers";
import CatalogPage from "./catalog";

/* eslint-disable */
jest.mock("../components/Button");
jest.mock("../components/Banner");

jest.mock("../components/MediaList", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("../components/Sidebar", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
/* eslint-enable */

const mockedMediaList = mockedClass(MediaList);
const mockedSidebar = mockedClass(Sidebar);

test("catalog", (): void => {
  let store = mockStore(mockStoreState({
    serverState: mockServerData([{
      id: "catalog",
      name: "Catalog",
    }, {
      id: "catalog2",
      name: "Catalog 2",
    }]),
  }));

  let catalogRef = Catalog.ref("catalog");
  let catalog = catalogRef.deref(store.state.serverState);

  let { container, rerender } = render(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    <CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>,
    store,
  );

  expect(mockedSidebar).toHaveBeenCalled();
  expect(lastCallArgs(mockedSidebar)[0].selectedItem).toBe(catalog);

  let banner = expectChild(container, ".mock-banner");

  expect(store.dispatch).not.toHaveBeenCalled();
  let button = expectChild(banner, ".mock-button[data-l10nid='banner-catalog-edit']");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showCatalogEditOverlay",
    payload: [
      expect.toBeRef("catalog"),
    ],
  });
  store.dispatch.mockClear();

  button = expectChild(banner, ".mock-button[data-l10nid='banner-album-new']");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumCreateOverlay",
    payload: [
      expect.toBeRef("catalog"),
    ],
  });
  store.dispatch.mockClear();

  button = expectChild(banner, ".mock-button[data-l10nid='banner-upload']");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showUploadOverlay",
    payload: [],
  });
  store.dispatch.mockClear();

  expect(mockedMediaList).toHaveBeenCalled();
  expect(lastCallArgs(mockedMediaList)[0].search).toEqual({
    catalog: expect.toBeRef("catalog"),
  });

  mockedMediaList.mockClear();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  rerender(<CatalogPage user={store.state.serverState.user!} catalog={catalogRef}/>);

  expect(mockedMediaList).not.toHaveBeenCalled();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  rerender(<CatalogPage user={store.state.serverState.user!} catalog={Catalog.ref("catalog")}/>);

  expect(mockedMediaList).not.toHaveBeenCalled();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  rerender(<CatalogPage user={store.state.serverState.user!} catalog={Catalog.ref("catalog2")}/>);

  expect(mockedMediaList).toHaveBeenCalled();
  expect(lastCallArgs(mockedMediaList)[0].search).toEqual({
    catalog: expect.toBeRef("catalog2"),
  });
});
