import React from "react";

import { lastCallArgs } from "../../../test-helpers";
import { Album } from "../api/highlevel";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
} from "../test-helpers";
import AlbumPage from "./album";

test("album", (): void => {
  let store = mockStore(mockStoreState({
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

  let albumRef = Album.ref("album1");

  let { container } = render(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    <AlbumPage user={store.state.serverState.user!} album={albumRef}/>,
    store,
  );

  let buttons = expectChild(container, "#banner-buttons");

  expect(store.dispatch).not.toHaveBeenCalled();
  let button = expectChild(buttons, "#button-banner-album-edit");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumEditOverlay",
    payload: [
      expect.toBeRef("album1"),
    ],
  });
  store.dispatch.mockClear();

  button = expectChild(buttons, "#button-banner-album-create");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumCreateOverlay",
    payload: [
      expect.toBeRef("album1"),
    ],
  });
  store.dispatch.mockClear();

  button = expectChild(buttons, "#button-banner-upload");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showUploadOverlay",
    payload: [],
  });
  store.dispatch.mockClear();
});
