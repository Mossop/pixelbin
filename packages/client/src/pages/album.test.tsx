import React from "react";

import { Album } from "../api/highlevel";
import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerData,
  mockedClass,
  lastCallArgs,
  expectChild,
  click,
} from "../test-helpers";
import { Field, Operation } from "../utils/search";
import AlbumPage from "./album";

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

test("album", (): void => {
  let store = mockStore(mockStoreState({
    serverState: mockServerData([{
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

  let albumRef = Album.ref("album1");
  let album = albumRef.deref(store.state.serverState);

  let { container, rerender } = render(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    <AlbumPage user={store.state.serverState.user!} album={albumRef}/>,
    store,
  );

  expect(mockedSidebar).toHaveBeenCalled();
  expect(lastCallArgs(mockedSidebar)[0].selectedItem).toBe(album);

  let banner = expectChild(container, ".mock-banner");

  expect(store.dispatch).not.toHaveBeenCalled();
  let button = expectChild(banner, ".mock-button[data-l10nid='banner-album-edit']");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumEditOverlay",
    payload: [
      expect.toBeRef("album1"),
    ],
  });
  store.dispatch.mockClear();

  button = expectChild(banner, ".mock-button[data-l10nid='banner-album-new']");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumCreateOverlay",
    payload: [
      expect.toBeRef("album1"),
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
    query: {
      invert: false,
      field: Field.Album,
      operation: Operation.Includes,
      value: "Album",
    },
  });

  mockedMediaList.mockClear();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  rerender(<AlbumPage user={store.state.serverState.user!} album={albumRef}/>);

  expect(mockedMediaList).not.toHaveBeenCalled();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  rerender(<AlbumPage user={store.state.serverState.user!} album={Album.ref("album1")}/>);

  expect(mockedMediaList).not.toHaveBeenCalled();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  rerender(<AlbumPage user={store.state.serverState.user!} album={Album.ref("album2")}/>);

  expect(mockedMediaList).toHaveBeenCalled();
  expect(lastCallArgs(mockedMediaList)[0].search).toEqual({
    catalog: expect.toBeRef("catalog"),
    query: {
      invert: false,
      field: Field.Album,
      operation: Operation.Includes,
      value: "Album 2",
    },
  });
});
