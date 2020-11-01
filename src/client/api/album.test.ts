/* eslint-disable @typescript-eslint/naming-convention */
import { emptyMetadata, Method } from "../../model";
import { mockedFunction } from "../../test-helpers";
import fetch from "../environment/fetch";
import { expect, mockProcessedMedia, mockMedia } from "../test-helpers";
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

  let result = await createAlbum(Catalog.ref("testcatalog"), {
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
      album: {
        name: "Test album",
        parent: null,
      },
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

  let result = await editAlbum(Album.ref("testalbum"), {
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
      album: {
        name: "New test album",
      },
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
  let media = mockMedia({
    id: "testmedia",
    albums: [{
      album: Album.ref("testalbum"),
    }],
  });

  mockResponse(Method.MediaRelations, 200, [
    mediaIntoResponse(media),
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
  let media = mockMedia({
    id: "testmedia",
  });

  mockResponse(Method.MediaRelations, 200, [
    mediaIntoResponse(media),
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
  let media = mockMedia({
    id: "testmedia",
    albums: [{
      album: Album.ref("testalbum"),
    }],
  });
  let media2 = mockProcessedMedia({
    id: "testmedia2",
    file: {
      id: "newfile",
    },
    albums: [{
      album: Album.ref("testalbum"),
    }],
  });

  mockResponse(Method.AlbumList, 200, [
    mediaIntoResponse(media),
    mediaIntoResponse(media2),
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
    catalog: expect.toBeRef("catalog"),
    created: expect.anything(),
    updated: expect.anything(),
    file: null,
    albums: [{
      album: expect.toBeRef("testalbum"),
    }],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: "testmedia2",
    catalog: expect.toBeRef("catalog"),
    created: expect.anything(),
    updated: expect.anything(),

    file: {
      id: "newfile",
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
    },

    albums: [{
      album: expect.toBeRef("testalbum"),
    }],
    tags: [],
    people: [],
  }]);
});
