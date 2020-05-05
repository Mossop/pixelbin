import moment from "moment";

import fetch from "../environment/fetch";
import { expect, mockedFunction } from "../test-helpers";
import {
  mockResponse,
  MockResponse,
  callInfo,
  MediaDataResponse,
  mediaIntoResponse,
  mockMedia,
  mockMetadata,
  mockMediaInfo,
} from "../test-helpers/api";
import { Catalog, mediaRef, Media } from "./highlevel";
import { getMedia, isProcessed, isUnprocessed, createMedia, updateMedia } from "./media";
import { ApiErrorData, ApiErrorCode, ServerData } from "./types";

jest.mock("../../js/environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Media reference", (): void => {
  let media: Media = mockMedia({});

  let ref = mediaRef(media);
  expect(ref.id).toBe(media.id);
  expect(ref.deref(null as unknown as ServerData)).toBe(media);
});

test("Get media", async (): Promise<void> => {
  let created = moment("2020-04-21T20:41:20.824Z");
  let media = mockMedia({
    id: "testmedia",
    created,
  });

  mockResponse(mockedFetch, new MockResponse<MediaDataResponse>(200, mediaIntoResponse(media)));

  let result = await getMedia("testmedia");

  expect(result).toEqual(media);

  expect(isProcessed(result)).toBeFalsy();
  expect(isUnprocessed(result)).toBeTruthy();

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "GET",
    path: "http://pixelbin/api/media/get/testmedia",
    headers: {
      "X-CSRFToken": "csrf-foobar",
    },
  });
});

test("Missing media", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<ApiErrorData>(404, {
    code: ApiErrorCode.NotFound,
    args: {},
  }));

  await expect(getMedia("testmedia")).rejects.toBeAppError(ApiErrorCode.NotFound);
});

test("Create media", async (): Promise<void> => {
  let created = moment("2020-04-21T20:41:20.824Z");
  let uploaded = moment("2020-05-22T20:41:12.824Z");
  let media = mockMedia({
    id: "testmedia",
    created,
    info: mockMediaInfo({
      processVersion: 10,
      uploaded,
      width: 1280,
      height: 1024,
    }),
    metadata: mockMetadata({
      city: "Portland",
      make: "Nikon",
    }),
  });

  mockResponse(mockedFetch, new MockResponse<MediaDataResponse>(200, mediaIntoResponse(media)));

  let result = await createMedia({
    catalog: Catalog.ref("testcatalog"),
    metadata: {
      city: "Portland",
      make: "Nikon",
    },
  });

  expect(result).toEqual(media);

  expect(isProcessed(result)).toBeTruthy();
  expect(isUnprocessed(result)).toBeFalsy();

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
      metadata: {
        city: "Portland",
        make: "Nikon",
      },
    },
  });
});

test("Edit media", async (): Promise<void> => {
  let created = moment("2020-04-21T20:41:20.824Z");
  let uploaded = moment("2020-11-21T20:21:20.824Z");
  let media: Media = mockMedia({
    id: "testmedia",
    created,
    info: mockMediaInfo({
      processVersion: 10,
      uploaded,
      width: 1280,
      height: 1024,
    }),
    metadata: mockMetadata({
      city: "London",
      make: "Nikon",
    }),
  });

  mockResponse(mockedFetch, new MockResponse<MediaDataResponse>(200, mediaIntoResponse(media)));

  let result = await updateMedia({
    id: mediaRef(media),
    metadata: {
      city: "London",
    },
  });

  expect(result).toEqual(mockMedia({
    id: "testmedia",
    created,
    info: mockMediaInfo({
      processVersion: 10,
      uploaded,
      width: 1280,
      height: 1024,
    }),
    metadata: mockMetadata({
      city: "London",
      make: "Nikon",
    }),
  }));

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "PUT",
    path: "http://pixelbin/api/media/update/testmedia",
    headers: {
      "X-CSRFToken": "csrf-foobar",
      "Content-Type": "application/json",
    },
    body: {
      metadata: {
        city: "London",
      },
    },
  });
});
