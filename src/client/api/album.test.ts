/* eslint-disable @typescript-eslint/naming-convention */
import { emptyMetadata, Method } from "../../model";
import { mockedFunction } from "../../test-helpers";
import fetch from "../environment/fetch";
import { expect, mockProcessedMedia, mockServerState, mockUnprocessedMedia } from "../test-helpers";
import { mockResponse, callInfo, mediaIntoResponse } from "../test-helpers/api";
import {
  createAlbum,
  editAlbum,
  addMediaToAlbum,
  removeMediaFromAlbum,
  listAlbumMedia,
  deleteAlbum,
} from "./album";
import { Catalog, Album, mediaRef } from "./highlevel";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Create album", async (): Promise<void> => {
  mockResponse(Method.AlbumCreate, 200, {
    id: "newalbum",
    catalog: "testcatalog",
    name: "Test album",
    parent: null,
  });

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
  mockResponse(Method.AlbumEdit, 200, {
    id: "testalbum",
    catalog: "testcatalog",
    name: "New test album",
    parent: "parentalbum",
  });

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

test("Delete album", async (): Promise<void> => {
  mockResponse(Method.AlbumDelete, 200, undefined);

  await deleteAlbum(Album.ref("testalbum"));
  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "DELETE",
    path: "http://pixelbin/api/album/delete",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: ["testalbum"],
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

  mockResponse(Method.MediaRelations, 200, [
    mediaIntoResponse(state, media),
  ]);

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

  mockResponse(Method.MediaRelations, 200, [
    mediaIntoResponse(state, media),
  ]);

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

test("List album", async (): Promise<void> => {
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
  let media2 = mockProcessedMedia({
    id: "testmedia2",
    albums: [
      Album.ref("testalbum"),
    ],
  });

  mockResponse(Method.AlbumList, 200, [
    mediaIntoResponse(state, media),
    mediaIntoResponse(state, media2),
  ]);

  let result = await listAlbumMedia(Album.ref("testalbum"), true);

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "GET",
    path: "http://pixelbin/api/album/list?id=testalbum&recursive=true",
    headers: {
      "X-CSRFToken": "csrf-foobar",
    },
  });

  expect(result).toEqual([{
    ...emptyMetadata,
    id: "testmedia",
    created: expect.anything(),
    updated: expect.anything(),
    albums: [
      expect.toBeRef("testalbum"),
    ],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: "testmedia2",
    created: expect.anything(),
    updated: expect.anything(),
    uploaded: expect.anything(),
    bitRate: null,
    duration: null,
    fileSize: 1024,
    frameRate: null,
    width: 1024,
    height: 768,
    mimetype: "image/jpeg",
    thumbnailUrl: expect.stringMatching(/^http:\/\/localhost\/media\/thumbnail\/testmedia2\//),
    originalUrl: expect.stringMatching(/^http:\/\/localhost\/media\/original\/testmedia2\//),
    posterUrl: null,
    albums: [
      expect.toBeRef("testalbum"),
    ],
    tags: [],
    people: [],
  }]);
});
