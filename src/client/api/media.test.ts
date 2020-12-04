/* eslint-disable @typescript-eslint/naming-convention */
import { ErrorCode, Method } from "../../model";
import { mockedFunction } from "../../test-helpers";
import { parseDateTime } from "../../utils";
import fetch from "../environment/fetch";
import { expect, mockMedia, mockStore } from "../test-helpers";
import { mockResponse, callInfo, mediaIntoResponse } from "../test-helpers/api";
import type { Media } from "./highlevel";
import { mediaRef } from "./highlevel";
import { getMedia } from "./media";
import type { ServerState } from "./types";
import { isProcessedMedia } from "./types";

jest.mock("../environment/fetch");

const mockedFetch = mockedFunction(fetch);

document.cookie = "csrftoken=csrf-foobar";

test("Media reference", (): void => {
  let media: Media = mockMedia({});

  let ref = mediaRef(media);
  expect(ref.id).toBe(media.id);
  expect(ref.deref(null as unknown as ServerState)).toBe(media);
});

test("Get media", async (): Promise<void> => {
  mockStore();

  let created = parseDateTime("2020-04-21T20:41:20.824Z");
  let media = mockMedia({
    id: "testmedia",
    created,
    taken: parseDateTime("2020-04-02T06:23:57Z"),
    takenZone: "UTC-8",
  });

  mockResponse(Method.MediaGet, 200, [mediaIntoResponse(media)]);

  let [result] = await getMedia(["testmedia"]);

  expect(result).toEqual({
    ...media,
    taken: expect.toEqualDate("2020-04-02T06:23:57-08:00"),
  });

  expect(isProcessedMedia(result!)).toBeFalsy();

  let info = callInfo(mockedFetch);
  expect(info).toEqual({
    method: "GET",
    path: "http://pixelbin/api/media/get?id=testmedia",
    headers: {
      "X-CSRFToken": "csrf-foobar",
    },
  });

  media = mockMedia({
    id: "testmedia",
    created,
    taken: parseDateTime("2019-11-03T23:07:19"),
    takenZone: "UTC-8",
    longitude: -122.6187,
    latitude: 45.5484,
  });

  mockResponse(Method.MediaGet, 200, [mediaIntoResponse(media)]);

  [result] = await getMedia(["testmedia"]);

  expect(result).toEqual({
    ...media,
    taken: expect.toEqualDate("2019-11-03T23:07:19-08:00", "America/Los_Angeles"),
    takenZone: "America/Los_Angeles",
  });

  media = mockMedia({
    id: "testmedia",
    created,
    taken: parseDateTime("2019-11-03T23:07:19"),
    takenZone: "UTC-2",
    longitude: -122.6187,
    latitude: 45.5484,
  });

  mockResponse(Method.MediaGet, 200, [mediaIntoResponse(media)]);

  [result] = await getMedia(["testmedia"]);

  expect(result).toEqual({
    ...media,
    taken: expect.toEqualDate("2019-11-03T23:07:19-02:00"),
    takenZone: "UTC-2",
  });

  media = mockMedia({
    id: "testmedia",
    created,
    taken: parseDateTime("2019-11-03T23:07:19"),
    takenZone: null,
    longitude: -122.6187,
    latitude: 45.5484,
  });

  expect(mediaIntoResponse(media).taken).toBe("2019-11-03T23:07:19.000");
  mockResponse(Method.MediaGet, 200, [mediaIntoResponse(media)]);

  [result] = await getMedia(["testmedia"]);

  expect(result).toEqual({
    ...media,
    taken: expect.toEqualDate("2019-11-03T23:07:19-08:00", "America/Los_Angeles"),
    takenZone: "America/Los_Angeles",
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
