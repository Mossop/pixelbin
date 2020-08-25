/* eslint-disable @typescript-eslint/naming-convention */
import { Api } from "../../../model";
import { mockedFunction } from "../../../test-helpers";
import fetch from "../environment/fetch";
import { expect, mockServerState, mockUnprocessedMedia } from "../test-helpers";
import {
  mockResponse,
  MockResponse,
  callInfo,
  mediaIntoResponse,
} from "../test-helpers/api";
import { createAlbum, editAlbum, addMediaToAlbum, removeMediaFromAlbum } from "./album";
import { Catalog, Album, mediaRef } from "./highlevel";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Create album", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<Api.Album>(200, {
    id: "newalbum",
    catalog: "testcatalog",
    name: "Test album",
    parent: null,
  }));

  let result = await createAlbum({
    catalog: Catalog.ref("testcatalog"),
    name: "Test album",
    parent: null,
  });

  expect(result).toEqual({
    id: "newalbum",
    catalog: expect.toBeRef("testcatalog"),
    name: "Test album",
    parent: null,
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/album/create",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: {
      catalog: "testcatalog",
      name: "Test album",
      parent: null,
    },
  });
});

test("Edit album", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<Api.Album>(200, {
    id: "testalbum",
    catalog: "testcatalog",
    name: "New test album",
    parent: "parentalbum",
  }));

  let result = await editAlbum({
    id: Album.ref("testalbum"),
    name: "New test album",
  });

  expect(result).toEqual({
    id: "testalbum",
    catalog: expect.toBeRef("testcatalog"),
    name: "New test album",
    parent: expect.toBeRef("parentalbum"),
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PATCH",
    path: "http://pixelbin/api/album/edit",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: {
      id: "testalbum",
      name: "New test album",
    },
  });
});

test("Add media", async (): Promise<void> => {
  let state = mockServerState([{
    id: "testcatalog",
    name: "Test catalog",
    albums: [{
      id: "testalbum",
      name: "Test album",
    }],
  }]);
  let media = mockUnprocessedMedia({
    id: "testmedia",
    albums: [
      Album.ref("testalbum"),
    ],
  });

  mockResponse(mockedFetch, new MockResponse<Api.UnprocessedMedia[]>(200, [
    mediaIntoResponse(state, media),
  ]));

  await addMediaToAlbum(Album.ref("testalbum"), [mediaRef(media)]);

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PATCH",
    path: "http://pixelbin/api/media/relations",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: [{
      operation: "add",
      type: "album",
      items: ["testalbum"],
      media: ["testmedia"],
    }],
  });
});

test("Remove media", async (): Promise<void> => {
  let state = mockServerState([{
    name: "Test catalog",
    albums: [{
      id: "testalbum",
      name: "Test album",
    }],
  }]);
  let media = mockUnprocessedMedia({
    id: "testmedia",
  });

  mockResponse(mockedFetch, new MockResponse<Api.UnprocessedMedia[]>(200, [
    mediaIntoResponse(state, media),
  ]));

  await removeMediaFromAlbum(Album.ref("testalbum"), [mediaRef(media)]);

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PATCH",
    path: "http://pixelbin/api/media/relations",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: [{
      operation: "delete",
      type: "album",
      items: ["testalbum"],
      media: ["testmedia"],
    }],
  });
});
