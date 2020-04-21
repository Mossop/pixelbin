import { createAlbum, editAlbum, addMediaToAlbum, removeMediaFromAlbum } from "../../js/api/album";
import { Catalog, Album, mediaRef } from "../../js/api/highlevel";
import fetch from "../../js/environment/fetch";
import { expect, mockedFunction } from "../helpers";
import { mockResponse, MockResponse, callInfo, mockMedia, AlbumDataResponse } from "../helpers/api";

jest.mock("../../js/environment/fetch");

const mockedFetch = mockedFunction(fetch);

beforeEach((): void => {
  mockedFetch.mockClear();
});

document.cookie = "csrftoken=csrf-foobar";

test("Create album", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<AlbumDataResponse>(200, {
    id: "newalbum",
    catalog: "testcatalog",
    stub: null,
    name: "Test album",
    parent: null,
  }));

  let result = await createAlbum({
    catalog: Catalog.ref("testcatalog"),
    name: "Test album",
  });

  expect(result).toEqual({
    id: "newalbum",
    catalog: expect.toBeRef("testcatalog"),
    name: "Test album",
    stub: null,
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
    },
  });
});

test("Edit album", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<AlbumDataResponse>(200, {
    id: "testalbum",
    catalog: "testcatalog",
    stub: "foo",
    name: "New test album",
    parent: "parentalbum",
  }));

  let result = await editAlbum({
    id: Album.ref("testalbum"),
    name: "New test album",
    stub: "foo",
  });

  expect(result).toEqual({
    id: "testalbum",
    catalog: expect.toBeRef("testcatalog"),
    name: "New test album",
    stub: "foo",
    parent: expect.toBeRef("parentalbum"),
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PATCH",
    path: "http://pixelbin/api/album/edit/testalbum",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: {
      name: "New test album",
      stub: "foo",
    },
  });
});

test("Add media", async (): Promise<void> => {
  let media = mockMedia({
    id: "testmedia",
  });

  mockResponse(mockedFetch, new MockResponse<AlbumDataResponse>(200, {
    id: "testalbum",
    catalog: "testcatalog",
    stub: "foo",
    name: "New test album",
    parent: "parentalbum",
  }));

  let result = await addMediaToAlbum(Album.ref("testalbum"), [mediaRef(media)]);

  expect(result).toEqual({
    id: "testalbum",
    catalog: expect.toBeRef("testcatalog"),
    name: "New test album",
    stub: "foo",
    parent: expect.toBeRef("parentalbum"),
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/album/add_media",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: {
      album: "testalbum",
      media: [
        "testmedia",
      ],
    },
  });
});

test("Remove media", async (): Promise<void> => {
  let media = mockMedia({
    id: "testmedia",
  });

  mockResponse(mockedFetch, new MockResponse<AlbumDataResponse>(200, {
    id: "testalbum",
    catalog: "testcatalog",
    stub: "foo",
    name: "New test album",
    parent: "parentalbum",
  }));

  let result = await removeMediaFromAlbum(Album.ref("testalbum"), [mediaRef(media)]);

  expect(result).toEqual({
    id: "testalbum",
    catalog: expect.toBeRef("testcatalog"),
    name: "New test album",
    stub: "foo",
    parent: expect.toBeRef("parentalbum"),
  });

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "DELETE",
    path: "http://pixelbin/api/album/remove_media",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": "csrf-foobar",
    },
    body: {
      album: "testalbum",
      media: [
        "testmedia",
      ],
    },
  });
});
