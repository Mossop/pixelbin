/* eslint-disable @typescript-eslint/naming-convention */
import { ErrorCode, Method } from "../../model";
import { mockedFunction } from "../../test-helpers";
import { parseDateTime } from "../../utils";
import fetch from "../environment/fetch";
import { expect, mockMedia } from "../test-helpers";
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
  let created = parseDateTime("2020-04-21T20:41:20.824Z");
  let media = mockMedia({
    id: "testmedia",
    created,
  });

  mockResponse(Method.MediaGet, 200, [mediaIntoResponse(media)]);

  let [result] = await getMedia(["testmedia"]);

  expect(result).toEqual(media);

  expect(isProcessedMedia(result!)).toBeFalsy();

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
