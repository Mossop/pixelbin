/* eslint-disable @typescript-eslint/naming-convention */
import { ErrorCode, Method } from "../../model";
import { mockedFunction } from "../../test-helpers";
import { parseDateTime } from "../../utils";
import fetch from "../environment/fetch";
import { expect, mockServerState, mockUnprocessedMedia } from "../test-helpers";
import { mockResponse, callInfo, mediaIntoResponse } from "../test-helpers/api";
import type { Media } from "./highlevel";
import { Catalog, mediaRef } from "./highlevel";
import { getMedia, createMedia } from "./media";
import type { ServerState } from "./types";
import { isProcessed, isUnprocessed } from "./types";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Media reference", (): void => {
  let media: Media = mockUnprocessedMedia({});

  let ref = mediaRef(media);
  expect(ref.id).toBe(media.id);
  expect(ref.deref(null as unknown as ServerState)).toBe(media);
});

test("Get media", async (): Promise<void> => {
  let serverState = mockServerState();

  let created = parseDateTime("2020-04-21T20:41:20.824Z");
  let media = mockUnprocessedMedia({
    id: "testmedia",
    created,
  });

  mockResponse(Method.MediaGet, 200, [mediaIntoResponse(serverState, media)]);

  let [result] = await getMedia(["testmedia"]);

  expect(result).toEqual(media);

  expect(isProcessed(result!)).toBeFalsy();
  expect(isUnprocessed(result!)).toBeTruthy();

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "GET",
    path: "http://pixelbin/api/media/get?id=testmedia",
    headers: {
      "X-CSRFToken": "csrf-foobar",
    },
  });
});

test("Missing media", async (): Promise<void> => {
  // TODO: This is not correct.
  mockResponse(Method.MediaGet, 404, {
    code: ErrorCode.NotFound,
    data: {},
  });

  await expect(getMedia(["testmedia"])).rejects.toBeAppError(ErrorCode.NotFound);
});

test("Create media", async (): Promise<void> => {
  let serverState = mockServerState();

  let created = parseDateTime("2020-04-21T20:41:20.824Z");
  let media = mockUnprocessedMedia({
    id: "testmedia",
    created,
    city: "Portland",
    make: "Nikon",
  });

  mockResponse(Method.MediaCreate, 200, mediaIntoResponse(serverState, media));

  let file = "testfile" as unknown as Blob;

  let result = await createMedia({
    catalog: Catalog.ref("testcatalog"),
    city: "Portland",
    make: "Nikon",
    file,
  });

  expect(result).toEqual(media);

  expect(isProcessed(result)).toBeFalsy();
  expect(isUnprocessed(result)).toBeTruthy();

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/media/create",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      catalog: "testcatalog",
      albums: [],
      tags: [],
      people: [],
      city: "Portland",
      make: "Nikon",
      file: "testfile",
    },
  });
});

// test("Edit media", async (): Promise<void> => {
//   let created = parseDateTime("2020-04-21T20:41:20.824Z");
//   let uploaded = parseDateTime("2020-11-21T20:21:20.824Z");
//   let media: Media = mockMedia({
//     id: "testmedia",
//     created,
//     info: mockMediaInfo({
//       processVersion: 10,
//       uploaded,
//       width: 1280,
//       height: 1024,
//     }),
//     metadata: mockMetadata({
//       city: "London",
//       make: "Nikon",
//     }),
//   });

//   mockResponse(mockedFetch, new MockResponse<MediaDataResponse>(200, mediaIntoResponse(media)));

//   let result = await updateMedia({
//     id: mediaRef(media),
//     metadata: {
//       city: "London",
//     },
//   });

//   expect(result).toEqual(mockMedia({
//     id: "testmedia",
//     created,
//     info: mockMediaInfo({
//       processVersion: 10,
//       uploaded,
//       width: 1280,
//       height: 1024,
//     }),
//     metadata: mockMetadata({
//       city: "London",
//       make: "Nikon",
//     }),
//   }));

//   let info = callInfo(mockedFetch);
//   expect(info).toEqual({
//     method: "PUT",
//     path: "http://pixelbin/api/media/update/testmedia",
//     headers: {
//       "X-CSRFToken": "csrf-foobar",
//       "Content-Type": "application/json",
//     },
//     body: {
//       metadata: {
//         city: "London",
//       },
//     },
//   });
// });
