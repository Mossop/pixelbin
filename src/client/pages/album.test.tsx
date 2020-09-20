import React from "react";

import { lastCallArgs } from "../../test-helpers";
import { Album } from "../api/highlevel";
import { MediaLookupType } from "../store/types";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
  resetDOM,
} from "../test-helpers";
import AlbumPage from "./album";

jest.mock("../api/api");

beforeEach(resetDOM);

test("album", async (): Promise<void> => {
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

  let { container, rerender } = render(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    <AlbumPage user={store.state.serverState.user!} album={albumRef}/>,
    store,
  );

  let buttons = expectChild(container, "#banner-buttons");

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "listMedia",
    payload: [{
      type: MediaLookupType.Album,
      album: expect.toBeRef("album1"),
      recursive: true,
    }],
  });
  store.dispatch.mockClear();

  let button = expectChild(buttons, "#pageoption-button-album-edit");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumEditOverlay",
    payload: [
      expect.toBeRef("album1"),
    ],
  });
  store.dispatch.mockClear();

  button = expectChild(buttons, "#pageoption-button-album-create");
  click(button);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "showAlbumCreateOverlay",
    payload: [
      expect.toBeRef("album1"),
    ],
  });
  store.dispatch.mockClear();

  rerender(<AlbumPage user={store.state.serverState.user!} album={albumRef}/>);
  expect(store.dispatch).not.toHaveBeenCalled();

  albumRef = Album.ref("album2");
  rerender(<AlbumPage user={store.state.serverState.user!} album={albumRef}/>);

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "listMedia",
    payload: [{
      type: MediaLookupType.Album,
      album: expect.toBeRef("album2"),
      recursive: true,
    }],
  });
  store.dispatch.mockClear();
});
