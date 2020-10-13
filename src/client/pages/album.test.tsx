import React from "react";

import { Api, emptyMetadata, Method } from "../../model";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { now } from "../../utils";
import { Album } from "../api/highlevel";
import MediaGallery from "../components/MediaGallery";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
  resetDOM,
  deferRequest,
} from "../test-helpers";
import { MediaLookupType } from "../utils/medialookup";
import AlbumPage from "./album";
import { PageType } from "./types";

jest.mock("../api/api");
jest.mock("../components/MediaGallery", () => jest.fn(() => null));

beforeEach(resetDOM);

const mockedMediaGallery = mockedFunction(MediaGallery);

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

  let { call, resolve } = deferRequest<Api.Media[]>();

  let { container, rerender } = render(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    <AlbumPage user={store.state.serverState.user!} album={albumRef}/>,
    store,
  );

  let buttons = expectChild(container, "#banner-buttons");

  expect(store.dispatch).toHaveBeenCalledTimes(0);

  await expect(call).resolves.toEqual([
    Method.AlbumList,
    {
      id: "album1",
      recursive: true,
    },
  ]);

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

  expect(mockedMediaGallery).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(mockedMediaGallery)[0]).toEqual({
    media: null,
    onClick: expect.anything(),
  });
  mockedMediaGallery.mockClear();

  let dt = now();

  let media = [{
    ...emptyMetadata,
    id: "media1",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: "media2",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: "media3",
    created: dt,
    updated: dt,
    albums: [],
    tags: [],
    people: [],
  }];

  await resolve(media);

  expect(mockedMediaGallery).toHaveBeenCalled();
  expect(lastCallArgs(mockedMediaGallery)[0]).toEqual({
    media,
    onClick: expect.anything(),
  });
  mockedMediaGallery.mockClear();

  let { call: call2, resolve: resolve2 } = deferRequest<Api.Media[]>();
  let wasCalled = false;
  void call2.then(() => wasCalled = true);

  rerender(<AlbumPage user={store.state.serverState.user!} album={albumRef}/>);
  expect(store.dispatch).not.toHaveBeenCalled();
  expect(wasCalled).toBeFalsy();

  albumRef = Album.ref("album2");
  rerender(<AlbumPage user={store.state.serverState.user!} album={albumRef}/>);

  expect(store.dispatch).not.toHaveBeenCalled();

  await expect(call2).resolves.toEqual([
    Method.AlbumList,
    {
      id: "album2",
      recursive: true,
    },
  ]);

  media = [media[0]];
  await resolve2(media);

  expect(mockedMediaGallery).toHaveBeenCalled();
  expect(lastCallArgs(mockedMediaGallery)[0]).toEqual({
    media,
    onClick: expect.anything(),
  });

  expect(store.dispatch).not.toHaveBeenCalled();
  // @ts-ignore: Testing.
  lastCallArgs(mockedMediaGallery)[0].onClick({ id: "foo" });

  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenLastCalledWith({
    type: "navigate",
    payload: [{
      page: {
        type: PageType.Media,
        media: "foo",
        lookup: {
          type: MediaLookupType.Album,
          album: expect.toBeRef("album2"),
          recursive: true,
        },
      },
    }],
  });
});
