import moment from "moment-timezone";
import React from "react";

import { Api } from "../../model";
import { fillMetadata } from "../../server/database";
import { lastCallArgs, mockedFunction } from "../../test-helpers";
import { Album } from "../api/highlevel";
import {
  expect,
  mockStore,
  render,
  mockStoreState,
  mockServerState,
  expectChild,
  click,
  deferRequest,
  mockUnprocessedMedia,
  resetDOM,
} from "../test-helpers";
import { mediaIntoResponse } from "../test-helpers/api";
import MediaManager from "../utils/MediaManager";
import AlbumPage from "./album";

jest.mock("../utils/MediaManager");
jest.mock("../api/api");

beforeEach(resetDOM);

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedRequestMediaList = mockedFunction(MediaManager.requestMediaList);

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
  let cancel = jest.fn();
  mockedRequestMediaList.mockImplementationOnce(() => cancel);

  let { container, rerender } = render(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    <AlbumPage user={store.state.serverState.user!} album={albumRef}/>,
    store,
  );

  let buttons = expectChild(container, "#banner-buttons");

  expect(store.dispatch).not.toHaveBeenCalled();
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

  expect(mockedRequestMediaList).toHaveBeenCalledTimes(1);
  let [request, handler] = mockedRequestMediaList.mock.calls[0];
  mockedRequestMediaList.mockClear();

  let { call, resolve } = deferRequest<Api.ResponseFor<Api.UnprocessedMedia>[]>();

  let resultPromise = request();

  expect(await call).toEqual([Api.Method.AlbumList, {
    id: "album1",
    recursive: true,
  }]);

  let created1 = moment("2019-04-03T09:08Z");
  let created2 = moment("2020-01-03T10:18");
  await resolve([
    mediaIntoResponse(store.state.serverState, mockUnprocessedMedia({
      id: "media1",
      created: created1,
    })),
    mediaIntoResponse(store.state.serverState, mockUnprocessedMedia({
      id: "media2",
      created: created2,
      city: "Portland",
    })),
  ]);

  let results = await resultPromise;
  expect(results).toEqual([fillMetadata({
    id: "media1",
    created: expect.toEqualDate(created1),
    tags: [],
    albums: [],
    people: [],
  }), fillMetadata({
    id: "media2",
    created: expect.toEqualDate(created2),
    city: "Portland",
    tags: [],
    albums: [],
    people: [],
  })]);

  expect(store.dispatch).not.toHaveBeenCalled();
  handler(results);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(store.dispatch)[0]).toEqual({
    type: "listedMedia",
    payload: [results],
  });

  expect(cancel).not.toHaveBeenCalled();

  rerender(<AlbumPage user={store.state.serverState.user!} album={albumRef}/>);
  expect(cancel).toHaveBeenCalledTimes(0);
  expect(mockedRequestMediaList).toHaveBeenCalledTimes(0);

  albumRef = Album.ref("album2");
  rerender(<AlbumPage user={store.state.serverState.user!} album={albumRef}/>);

  expect(cancel).toHaveBeenCalledTimes(1);
  expect(mockedRequestMediaList).toHaveBeenCalledTimes(1);
});
