import moment from "moment";

import { Catalog, mediaRef, Media } from "../../js/api/highlevel";
import { getMedia, isProcessed, isUnprocessed, createMedia, updateMedia } from "../../js/api/media";
import { ApiErrorData, ApiErrorCode, ServerData } from "../../js/api/types";
import fetch from "../../js/environment/fetch";
import { expect, mockedFunction } from "../helpers";
import {
  mockResponse,
  MockResponse,
  callInfo,
  MediaDataResponse,
  mockMediaResponse,
  mockMedia,
  mockMetadata,
  mockMetadataResponse,
  mockMediaInfoResponse,
  mockMediaInfo,
} from "../helpers/api";

jest.mock("../../js/environment/fetch");

const mockedFetch = mockedFunction(fetch);

beforeEach((): void => {
  mockedFetch.mockClear();
});

document.cookie = "csrftoken=csrf-foobar";

test("Media reference", (): void => {
  let media: Media = mockMedia({});

  let ref = mediaRef(media);
  expect(ref.id).toBe(media.id);
  expect(ref.deref(null as unknown as ServerData)).toBe(media);
});

test("Get media", async (): Promise<void> => {
  mockResponse(mockedFetch, new MockResponse<MediaDataResponse>(200, mockMediaResponse({
    id: "testmedia",
    created: "2020-04-21T20:41:20.824Z",
  })));

  let result = await getMedia("testmedia");

  expect(result).toEqual(mockMedia({
    id: "testmedia",
    created: moment("2020-04-21T20:41:20.824Z"),
  }));

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
  mockResponse(mockedFetch, new MockResponse<MediaDataResponse>(200, mockMediaResponse({
    id: "testmedia",
    created: "2020-04-21T20:41:20.824Z",
    info: mockMediaInfoResponse({
      processVersion: 10,
      uploaded: "2020-04-21T20:41:20.824Z",
      width: 1280,
      height: 1024,
    }),
    metadata: mockMetadataResponse({
      city: "Portland",
      make: "Nikon",
    }),
  })));

  let result = await createMedia({
    catalog: Catalog.ref("testcatalog"),
    metadata: {
      city: "Portland",
      make: "Nikon",
    },
  });

  expect(result).toEqual(mockMedia({
    id: "testmedia",
    created: moment("2020-04-21T20:41:20.824Z"),
    info: mockMediaInfo({
      processVersion: 10,
      uploaded: moment("2020-04-21T20:41:20.824Z"),
      width: 1280,
      height: 1024,
    }),
    metadata: mockMetadata({
      city: "Portland",
      make: "Nikon",
    }),
  }));

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
  let media: Media = mockMedia({
    id: "testmedia",
  });

  mockResponse(mockedFetch, new MockResponse<MediaDataResponse>(200, mockMediaResponse({
    id: "testmedia",
    created: "2020-04-21T20:41:20.824Z",
    info: mockMediaInfoResponse({
      processVersion: 10,
      uploaded: "2020-04-21T20:41:20.824Z",
      width: 1280,
      height: 1024,
    }),
    metadata: mockMetadataResponse({
      city: "London",
      make: "Nikon",
    }),
  })));

  let result = await updateMedia({
    id: mediaRef(media),
    metadata: {
      city: "London",
    },
  });

  expect(result).toEqual(mockMedia({
    id: "testmedia",
    created: moment("2020-04-21T20:41:20.824Z"),
    info: mockMediaInfo({
      processVersion: 10,
      uploaded: moment("2020-04-21T20:41:20.824Z"),
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
