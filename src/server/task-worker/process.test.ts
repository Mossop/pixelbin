import { promises as fs, createReadStream } from "fs";
import path from "path";

import { exiftool } from "exiftool-vendored";
import mockConsole from "jest-mock-console";
import sharp from "sharp";
import type { DirectoryResult } from "tmp-promise";
import { dir as tmpdir } from "tmp-promise";

import { AlternateFileType, emptyMetadata } from "../../model";
import { mockedFunction, expect, lastCallArgs, mockDateTime, deferCall } from "../../test-helpers";
import { isoDateTime, now, parseDateTime } from "../../utils";
import { connection, insertTestData, buildTestDB, insertData } from "../database/test-helpers";
import { Table } from "../database/types";
import type { MediaFile } from "../database/types/tables";
import { StorageService } from "../storage";
import type { VideoInfo } from "./ffmpeg";
import { encodeVideo, AudioCodec, VideoCodec, Container } from "./ffmpeg";
import {
  fullReprocess,
  handleUploadedFile,
  MEDIA_THUMBNAIL_SIZES,
  purgeDeletedMedia,
} from "./process";
import services, { provideService } from "./services";

/* eslint-disable */
jest.mock("../storage");
jest.mock("./ffmpeg", () => {
  let actual = jest.requireActual("./ffmpeg");
  return {
    ...actual,
    encodeVideo: jest.fn(),
  };
});
/* eslint-enable */

buildTestDB();
provideService("database", connection);

beforeEach(insertTestData);

let mockedEncodeVideo = mockedFunction(encodeVideo);

let temp: DirectoryResult | undefined;

beforeAll(async (): Promise<void> => {
  let dbConnection = await connection;

  temp = await tmpdir({
    unsafeCleanup: true,
  });

  let storageService = new StorageService({
    tempDirectory: path.join(temp.path, "temp"),
    localDirectory: path.join(temp.path, "local"),
  }, dbConnection);
  provideService("storage", storageService);
});

afterAll(async (): Promise<void> => {
  if (temp) {
    await temp.cleanup();
    temp = undefined;
  }
  await exiftool.end();
});

provideService("exiftool", exiftool);

test("Process image metadata", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let created = mockDateTime("2014-06-21T02:56:53Z");
  let uploaded = parseDateTime("2015-06-21T02:56:53Z");
  let sourceFile = path.join(__dirname, "..", "..", "..", "testdata", "lamppost.jpg");

  let media = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    city: "Portland",
  });

  getUploadedFileMock.mockResolvedValueOnce({
    catalog: "c1",
    media: media.id,
    name: "Testname.jpg",
    uploaded,
    path: sourceFile,
  });

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getLocalFilePathMock = mockedFunction(storage.getLocalFilePath);
  getLocalFilePathMock.mockImplementation(
    async (media: string, original: string, name: string): Promise<string> => {
      await fs.mkdir(path.join(temp!.path, "local", media, original), {
        recursive: true,
      });
      return Promise.resolve(path.join(temp!.path, "local", media, original, name));
    },
  );

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);

  let buffers: Map<string, Buffer> = new Map();
  storeFileMock.mockImplementation(
    async (media: string, mediaFile: string, filename: string, source: string): Promise<void> => {
      buffers.set(filename, await fs.readFile(source));
    },
  );

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);

  let [fullMedia] = await user1Db.getMedia([media.id]);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(uploaded),

    file: {
      uploaded: expect.toEqualDate(uploaded),
      processVersion: 2,
      mimetype: "image/jpeg",
      width: 500,
      height: 331,
      duration: null,
      frameRate: null,
      bitRate: null,
      fileSize: 55084,
      fileName: "Testname.jpg",
      id: expect.toBeId("I"),

      alternatives: expect.toInclude([{
        bitRate: null,
        duration: null,
        fileName: "Testname-webp.webp",
        fileSize: 8716,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 500,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-jpg.jpg",
        fileSize: 20706,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 500,
      }]),
      thumbnails: expect.toInclude([{
        bitRate: null,
        duration: null,
        fileName: "Testname-150.jpg",
        fileSize: 5456,
        frameRate: null,
        height: 99,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 150,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-150.webp",
        fileSize: 4342,
        frameRate: null,
        height: 99,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 150,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-200.jpg",
        fileSize: 6270,
        frameRate: null,
        height: 132,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 200,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-200.webp",
        fileSize: 4634,
        frameRate: null,
        height: 132,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 200,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-250.jpg",
        fileSize: 7297,
        frameRate: null,
        height: 166,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 250,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-250.webp",
        fileSize: 5066,
        frameRate: null,
        height: 166,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 250,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-300.jpg",
        fileSize: 8387,
        frameRate: null,
        height: 199,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 300,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-300.webp",
        fileSize: 5518,
        frameRate: null,
        height: 199,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 300,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-350.jpg",
        fileSize: 9503,
        frameRate: null,
        height: 232,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 350,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-350.webp",
        fileSize: 6014,
        frameRate: null,
        height: 232,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 350,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-400.jpg",
        fileSize: 10759,
        frameRate: null,
        height: 265,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 400,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-400.webp",
        fileSize: 6432,
        frameRate: null,
        height: 265,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 400,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-450.jpg",
        fileSize: 12385,
        frameRate: null,
        height: 298,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 450,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-450.webp",
        fileSize: 7040,
        frameRate: null,
        height: 298,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 450,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-500.jpg",
        fileSize: 14033,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 500,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testname-500.webp",
        fileSize: 7596,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 500,
      }]),
    },

    filename: "Testname.jpg",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2018-08-22T18:51:25.800-07:00"),
    takenZone: "UTC-7",
    longitude: -121.517784,
    latitude: 45.715054,
    altitude: 28.4597,
    location: "Hood River Waterfront Park",
    city: "Portland",
    state: "Oregon",
    country: "USA",
    orientation: null,
    make: "NIKON CORPORATION",
    model: "NIKON D7000",
    lens: "18.0-200.0 mm f/3.5-5.6",
    photographer: "Dave Townsend",
    aperture: 11,
    shutterSpeed: "1/2000",
    iso: 400,
    focalLength: 95,
    rating: 4,

    albums: [],
    tags: [],
    people: [],
  });

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(1);

  let mediaFile = fullMedia!.file!.id;

  let metadataFile = path.join(temp!.path, "local", media.id, mediaFile, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("lamppost-metadata");

  expect(storeFileMock).toHaveBeenCalledTimes(19);
  expect(storeFileMock.mock.calls).toInclude([
    [media.id, mediaFile, "Testname-webp.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname-jpg.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-150.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-150.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname-200.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-200.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname-250.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-250.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname-300.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-300.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname-350.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-350.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname-400.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-400.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname-450.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-450.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname-500.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-500.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testname.jpg", sourceFile, "image/jpeg"],
  ]);

  expect(mockedEncodeVideo).not.toHaveBeenCalled();

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let buffer = buffers.get(`Testname-${size}.jpg`);
    expect(buffer).not.toBeUndefined();
    expect(await sharp(buffer).png().toBuffer()).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-jpg-${size}`,
    });

    buffer = buffers.get(`Testname-${size}.webp`);
    expect(buffer).not.toBeUndefined();
    expect(await sharp(buffer).png().toBuffer()).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-webp-${size}`,
    });
  }
});

test("Process image fails", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let storage = (await (await services.storage).getStorage("")).get();
  let rollback = mockedFunction(storage["rollback"] as () => Promise<void>);

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let created = mockDateTime("2014-06-21T02:56:53Z");
  let uploaded = parseDateTime("2015-06-21T02:56:53Z");
  let sourceFile = path.join(__dirname, "..", "..", "..", "testdata", "lamppost.jpg");

  let media = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    city: "Portland",
  });

  getUploadedFileMock.mockResolvedValueOnce({
    catalog: "c1",
    media: media.id,
    name: "Testname.jpg",
    uploaded,
    path: sourceFile,
  });

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);
  storeFileMock.mockRejectedValueOnce(new Error("Failed to upload file."));

  let call = deferCall(rollback);

  let result = handleUploadedFile(media.id);

  await call.call;
  expect(storeFileMock).toHaveBeenCalled();
  storeFileMock.mockClear();
  await call.resolve();

  await expect(result).rejects.toThrow("Failed to upload file.");

  expect(deleteUploadedFileMock).not.toHaveBeenCalled();
  expect(rollback).toHaveBeenCalledTimes(1);

  let [fullMedia] = await user1Db.getMedia([media.id]);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(created),

    file: null,

    ...emptyMetadata,
    city: "Portland",

    albums: [],
    tags: [],
    people: [],
  });

  expect(storeFileMock).not.toHaveBeenCalled();
});

test("Process video metadata", async (): Promise<void> => {
  mockConsole();
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let uploaded = parseDateTime("2017-01-02T02:56:53Z");
  let sourceFile = path.join(__dirname, "..", "..", "..", "testdata", "video.mp4");

  let created = mockDateTime("2016-01-02T02:56:53Z");
  let media = await user1Db.createMedia("c1", emptyMetadata);

  getUploadedFileMock.mockResolvedValueOnce({
    catalog: "c1",
    media: media.id,
    name: "Testvideo.mp4",
    uploaded,
    path: sourceFile,
  });

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getLocalFilePathMock = mockedFunction(storage.getLocalFilePath);
  getLocalFilePathMock.mockImplementation(
    async (media: string, original: string, name: string): Promise<string> => {
      await fs.mkdir(path.join(temp!.path, "local", media, original), {
        recursive: true,
      });
      return Promise.resolve(path.join(temp!.path, "local", media, original, name));
    },
  );

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);

  let buffers: Map<string, Buffer> = new Map();
  storeFileMock.mockImplementation(
    async (media: string, mediaFile: string, filename: string, source: string): Promise<void> => {
      buffers.set(filename, await fs.readFile(source));
    },
  );

  mockedEncodeVideo.mockImplementationOnce(async (
    video: string,
    videoCodec: VideoCodec,
    audioCodec: AudioCodec,
    container: Container,
    target: string,
  ): Promise<VideoInfo> => {
    await fs.writeFile(target, "foobar");

    return {
      format: {
        duration: 100,
        bitRate: 1000000,
        container,
        size: 2000000,
        mimetype: `video/${container};codecs="foo, bar"`,
      },
      videoStream: {
        codec: videoCodec,
        frameRate: 30,
        width: 1920,
        height: 1080,
      },
      audioStream: {
        codec: audioCodec,
      },
    };
  });

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);

  let [fullMedia] = await user1Db.getMedia([media.id]);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(uploaded),

    file: {
      uploaded: expect.toEqualDate(uploaded),
      processVersion: 2,
      fileSize: 4059609,
      width: 1920,
      height: 1080,
      mimetype: "video/mp4;codecs=\"avc1.64002a,mp4a.40.2\"",
      duration: 1.74,
      bitRate: 18664868,
      frameRate: 59.202206,
      fileName: "Testvideo.mp4",
      id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
      alternatives: expect.toInclude([{
        bitRate: 1000000,
        duration: 100,
        fileName: "Testvideo-h264.mp4",
        fileSize: 2000000,
        frameRate: 30,
        height: 1080,
        id: expect.toBeId("F"),
        mimetype: "video/mp4;codecs=\"foo, bar\"",
        width: 1920,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-webp.webp",
        fileSize: 93194,
        frameRate: null,
        height: 1920,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 1080,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-jpg.jpg",
        fileSize: 184460,
        frameRate: null,
        height: 1920,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 1080,
      }]),
      thumbnails: expect.toInclude([{
        bitRate: null,
        duration: null,
        fileName: "Testvideo-150.jpg",
        fileSize: 3433,
        frameRate: null,
        height: 150,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 84,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-150.webp",
        fileSize: 1986,
        frameRate: null,
        height: 150,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 84,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-200.jpg",
        fileSize: 5372,
        frameRate: null,
        height: 200,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 113,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-200.webp",
        fileSize: 2926,
        frameRate: null,
        height: 200,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 113,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-250.jpg",
        fileSize: 7646,
        frameRate: null,
        height: 250,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 141,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-250.webp",
        fileSize: 4084,
        frameRate: null,
        height: 250,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 141,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-300.jpg",
        fileSize: 10280,
        frameRate: null,
        height: 300,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 169,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-300.webp",
        fileSize: 5360,
        frameRate: null,
        height: 300,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 169,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-350.jpg",
        fileSize: 13295,
        frameRate: null,
        height: 350,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 197,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-350.webp",
        fileSize: 6866,
        frameRate: null,
        height: 350,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 197,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-400.jpg",
        fileSize: 16596,
        frameRate: null,
        height: 400,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 225,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-400.webp",
        fileSize: 8516,
        frameRate: null,
        height: 400,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 225,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-450.jpg",
        fileSize: 20075,
        frameRate: null,
        height: 450,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 253,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-450.webp",
        fileSize: 10146,
        frameRate: null,
        height: 450,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 253,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-500.jpg",
        fileSize: 24073,
        frameRate: null,
        height: 500,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 281,
      }, {
        bitRate: null,
        duration: null,
        fileName: "Testvideo-500.webp",
        fileSize: 12256,
        frameRate: null,
        height: 500,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 281,
      }]),
    },

    filename: "Testvideo.mp4",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2019-11-03T23:07:19-08:00"),
    takenZone: "UTC-8",
    longitude: -122.6187,
    latitude: 45.5484,
    altitude: null,
    location: null,
    city: null,
    state: null,
    country: null,
    orientation: 1,
    make: "motorola",
    model: "moto g(7)",
    lens: null,
    photographer: null,
    aperture: null,
    shutterSpeed: null,
    iso: null,
    focalLength: null,
    rating: null,

    albums: [],
    tags: [],
    people: [],
  });

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(1);

  let mediaFile = fullMedia!.file!.id;

  let metadataFile = path.join(temp!.path, "local", media.id, mediaFile, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("video-metadata");

  expect(mockedEncodeVideo).toHaveBeenCalledTimes(1);
  let lastEncodeArgs = lastCallArgs(mockedEncodeVideo);
  expect(lastEncodeArgs).toEqual([
    sourceFile,
    VideoCodec.H264,
    AudioCodec.AAC,
    Container.MP4,
    expect.anything(),
  ]);

  expect(storeFileMock).toHaveBeenCalledTimes(20);
  expect(storeFileMock.mock.calls).toInclude([
    [media.id, mediaFile, "Testvideo-h264.mp4", lastEncodeArgs[4], "video/mp4;codecs=\"foo, bar\""],
    [media.id, mediaFile, "Testvideo-webp.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testvideo-jpg.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-150.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-150.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testvideo-200.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-200.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testvideo-250.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-250.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testvideo-300.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-300.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testvideo-350.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-350.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testvideo-400.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-400.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testvideo-450.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-450.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "Testvideo-500.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-500.webp", expect.anything(), "image/webp"],
    [
      media.id,
      mediaFile,
      "Testvideo.mp4",
      sourceFile,
      "video/mp4;codecs=\"avc1.64002a,mp4a.40.2\"",
    ],
  ]);

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let buffer = buffers.get(`Testvideo-${size}.jpg`);
    expect(buffer).not.toBeUndefined();
    expect(await sharp(buffer).png().toBuffer()).toMatchImageSnapshot({
      customSnapshotIdentifier: `video-thumb-jpg-${size}`,
    });

    buffer = buffers.get(`Testvideo-${size}.webp`);
    expect(buffer).not.toBeUndefined();
    expect(await sharp(buffer).png().toBuffer()).toMatchImageSnapshot({
      customSnapshotIdentifier: `video-thumb-webp-${size}`,
    });
  }
});

test("Process second file", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let created = mockDateTime("2018-01-01T02:56:53Z");

  let media = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    photographer: "Dave",
  });

  let fileUploaded = parseDateTime("2020-01-01T02:56:53Z");

  let oldMediaFile = await dbConnection.withNewMediaFile(
    media.id,
    {
      ...emptyMetadata,
      processVersion: 2,
      city: "London",
      uploaded: fileUploaded,
      fileName: "old.jpg",
      fileSize: 1000,
      mimetype: "image/jpeg",
      width: 100,
      height: 200,
      duration: null,
      frameRate: null,
      bitRate: null,
    },
    async (
      db: unknown,
      mediaFile: MediaFile,
    ): Promise<MediaFile> => mediaFile,
  );

  let [foundMedia] = await user1Db.getMedia([media.id]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id: media.id,
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(fileUploaded),
    catalog: "c1",

    file: {
      processVersion: 2,
      uploaded: expect.toEqualDate(fileUploaded),
      fileSize: 1000,
      fileName: "old.jpg",
      id: oldMediaFile.id,
      mimetype: "image/jpeg",
      width: 100,
      height: 200,
      duration: null,
      frameRate: null,
      bitRate: null,
      thumbnails: [],
      alternatives: [],
    },

    city: "London",
    photographer: "Dave",
    albums: [],
    people: [],
    tags: [],
  });

  let uploaded = parseDateTime("2020-01-02T02:56:53Z");
  let sourceFile = path.join(__dirname, "..", "..", "..", "testdata", "lamppost.jpg");

  getUploadedFileMock.mockResolvedValueOnce({
    catalog: "c1",
    media: media.id,
    name: "NewFile.jpg",
    uploaded,
    path: sourceFile,
  });

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getLocalFilePathMock = mockedFunction(storage.getLocalFilePath);
  getLocalFilePathMock.mockImplementation(
    async (media: string, original: string, name: string): Promise<string> => {
      await fs.mkdir(path.join(temp!.path, "local", media, original), {
        recursive: true,
      });
      return Promise.resolve(path.join(temp!.path, "local", media, original, name));
    },
  );

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);

  let buffers: Map<string, Buffer> = new Map();
  storeFileMock.mockImplementation(
    async (
      media: string,
      mediaFile: string,
      filename: string,
      source: string,
    ): Promise<void> => {
      buffers.set(filename, await fs.readFile(source));
    },
  );

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);

  let [fullMedia] = await user1Db.getMedia([media.id]);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(uploaded),

    file: {
      processVersion: 2,
      uploaded: expect.toEqualDate(uploaded),
      mimetype: "image/jpeg",
      width: 500,
      height: 331,
      duration: null,
      frameRate: null,
      bitRate: null,
      fileSize: 55084,
      fileName: "NewFile.jpg",
      id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
      alternatives: expect.toInclude([{
        bitRate: null,
        duration: null,
        fileName: "NewFile-webp.webp",
        fileSize: 8716,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 500,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-jpg.jpg",
        fileSize: 20706,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 500,
      }]),
      thumbnails: expect.toInclude([{
        bitRate: null,
        duration: null,
        fileName: "NewFile-150.jpg",
        fileSize: 5456,
        frameRate: null,
        height: 99,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 150,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-150.webp",
        fileSize: 4342,
        frameRate: null,
        height: 99,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 150,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-200.jpg",
        fileSize: 6270,
        frameRate: null,
        height: 132,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 200,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-200.webp",
        fileSize: 4634,
        frameRate: null,
        height: 132,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 200,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-250.jpg",
        fileSize: 7297,
        frameRate: null,
        height: 166,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 250,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-250.webp",
        fileSize: 5066,
        frameRate: null,
        height: 166,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 250,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-300.jpg",
        fileSize: 8387,
        frameRate: null,
        height: 199,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 300,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-300.webp",
        fileSize: 5518,
        frameRate: null,
        height: 199,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 300,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-350.jpg",
        fileSize: 9503,
        frameRate: null,
        height: 232,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 350,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-350.webp",
        fileSize: 6014,
        frameRate: null,
        height: 232,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 350,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-400.jpg",
        fileSize: 10759,
        frameRate: null,
        height: 265,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 400,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-400.webp",
        fileSize: 6432,
        frameRate: null,
        height: 265,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 400,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-450.jpg",
        fileSize: 12385,
        frameRate: null,
        height: 298,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 450,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-450.webp",
        fileSize: 7040,
        frameRate: null,
        height: 298,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 450,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-500.jpg",
        fileSize: 14033,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 500,
      }, {
        bitRate: null,
        duration: null,
        fileName: "NewFile-500.webp",
        fileSize: 7596,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 500,
      }]),
    },

    filename: "NewFile.jpg",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2018-08-22T18:51:25.800-07:00"),
    takenZone: "UTC-7",
    longitude: -121.517784,
    latitude: 45.715054,
    altitude: 28.4597,
    location: "Hood River Waterfront Park",
    city: "Hood River",
    state: "Oregon",
    country: "USA",
    orientation: null,
    make: "NIKON CORPORATION",
    model: "NIKON D7000",
    lens: "18.0-200.0 mm f/3.5-5.6",
    photographer: "Dave",
    aperture: 11,
    shutterSpeed: "1/2000",
    iso: 400,
    focalLength: 95,
    rating: 4,

    albums: [],
    tags: [],
    people: [],
  });

  let mediaFile = fullMedia!.file!.id;
  expect(mediaFile).not.toBe(oldMediaFile.id);

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(1);

  let metadataFile = path.join(temp!.path, "local", media.id, mediaFile, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("newfile-metadata");

  expect(storeFileMock).toHaveBeenCalledTimes(19);
  expect(storeFileMock.mock.calls).toInclude([
    [media.id, mediaFile, "NewFile-webp.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile-jpg.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-150.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-150.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile-200.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-200.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile-250.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-250.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile-300.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-300.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile-350.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-350.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile-400.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-400.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile-450.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-450.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile-500.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "NewFile-500.webp", expect.anything(), "image/webp"],
    [media.id, mediaFile, "NewFile.jpg", sourceFile, "image/jpeg"],
  ]);

  expect(mockedEncodeVideo).not.toHaveBeenCalled();

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let buffer = buffers.get(`NewFile-${size}.jpg`);
    expect(buffer).not.toBeUndefined();
    expect(await sharp(buffer).png().toBuffer()).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-jpg-${size}`,
    });

    buffer = buffers.get(`NewFile-${size}.webp`);
    expect(buffer).not.toBeUndefined();
    expect(await sharp(buffer).png().toBuffer()).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-webp-${size}`,
    });
  }
});

test("Update old version", async (): Promise<void> => {
  let dbConnection = await connection;
  let createdDT = parseDateTime("2020-01-01T02:02:02Z");

  await insertData({
    [Table.MediaInfo]: [{
      id: "media1",
      created: createdDT,
      deleted: false,
      catalog: "c1",
      updated: createdDT,
      ...emptyMetadata,
      city: "London",
    }],
    [Table.MediaFile]: [{
      id: "original1",
      media: "media1",
      uploaded: parseDateTime("2020-03-01T01:01:01Z"),
      processVersion: 1,
      fileName: "orig1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
      photographer: "Dave",
    }],
    [Table.AlternateFile]: [{
      id: "alternate1",
      mediaFile: "original1",
      type: AlternateFileType.Reencode,
      fileName: "alt1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate2",
      mediaFile: "original1",
      type: AlternateFileType.Reencode,
      fileName: "alt2.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate3",
      mediaFile: "original1",
      type: AlternateFileType.Thumbnail,
      fileName: "alt3.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }],
  });

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteFile = mockedFunction(storage.deleteFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteLocalFiles = mockedFunction(storage.deleteLocalFiles);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let streamFile = mockedFunction(storage.streamFile);

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getLocalFilePathMock = mockedFunction(storage.getLocalFilePath);
  getLocalFilePathMock.mockImplementation(
    async (media: string, original: string, name: string): Promise<string> => {
      await fs.mkdir(path.join(temp!.path, "local", media, original), {
        recursive: true,
      });
      return Promise.resolve(path.join(temp!.path, "local", media, original, name));
    },
  );

  let fileUploaded = parseDateTime("2020-03-01T01:01:01Z");
  let data = {
    uploaded: isoDateTime(fileUploaded),
    fileName: "oldname.jpg",
  };

  await fs.mkdir(path.join(temp!.path, "local", "media1", "original1"), {
    recursive: true,
  });
  let metaFile = path.join(temp!.path, "local", "media1", "original1", "metadata.json");
  await fs.writeFile(metaFile, JSON.stringify(data));

  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let [foundMedia] = await user1Db.getMedia(["media1"]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id: "media1",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate("2020-03-01T01:01:01Z"),
    catalog: "c1",

    file: {
      processVersion: 1,
      uploaded: expect.toEqualDate("2020-03-01T01:01:01Z"),
      fileSize: 100,
      fileName: "orig1.jpg",
      id: "original1",
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      frameRate: null,
      bitRate: null,
      thumbnails: [{
        id: "alternate3",
        fileName: "alt3.jpg",
        fileSize: 100,
        mimetype: "image/jpeg",
        width: 100,
        height: 100,
        duration: null,
        bitRate: null,
        frameRate: null,
      }],
      alternatives: expect.toInclude([{
        id: "alternate1",
        fileName: "alt1.jpg",
        fileSize: 100,
        mimetype: "image/jpeg",
        width: 100,
        height: 100,
        duration: null,
        bitRate: null,
        frameRate: null,
      }, {
        id: "alternate2",
        fileName: "alt2.jpg",
        fileSize: 100,
        mimetype: "image/jpeg",
        width: 100,
        height: 100,
        duration: null,
        bitRate: null,
        frameRate: null,
      }]),
    },

    city: "London",
    photographer: "Dave",
    albums: [],
    people: [],
    tags: [],
  });

  let sourceFile = path.join(__dirname, "..", "..", "..", "testdata", "lamppost.jpg");
  streamFile.mockImplementationOnce(async (): Promise<NodeJS.ReadableStream> => {
    return createReadStream(sourceFile);
  });

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);

  let buffers: Map<string, Buffer> = new Map();
  storeFileMock.mockImplementation(
    async (
      media: string,
      mediaFile: string,
      filename: string,
      source: string,
    ): Promise<void> => {
      buffers.set(filename, await fs.readFile(source));
    },
  );

  await fullReprocess("media1");

  expect(getUploadedFileMock).not.toHaveBeenCalled();
  expect(deleteUploadedFileMock).not.toHaveBeenCalled();
  expect(streamFile).toHaveBeenCalledTimes(1);
  expect(streamFile).toHaveBeenCalledWith("media1", "original1", "orig1.jpg");

  let [fullMedia] = await user1Db.getMedia(["media1"]);
  expect(fullMedia).toEqual({
    id: "media1",
    catalog: "c1",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(fileUploaded),

    file: {
      processVersion: 2,
      uploaded: expect.toEqualDate(fileUploaded),
      mimetype: "image/jpeg",
      width: 500,
      height: 331,
      duration: null,
      frameRate: null,
      bitRate: null,
      fileSize: 55084,
      fileName: "oldname.jpg",
      id: expect.toBeId("I"),
      alternatives: expect.toInclude([{
        bitRate: null,
        duration: null,
        fileName: "oldname-webp.webp",
        fileSize: 8716,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 500,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-jpg.jpg",
        fileSize: 20706,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 500,
      }]),
      thumbnails: expect.toInclude([{
        bitRate: null,
        duration: null,
        fileName: "oldname-150.jpg",
        fileSize: 5456,
        frameRate: null,
        height: 99,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 150,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-150.webp",
        fileSize: 4342,
        frameRate: null,
        height: 99,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 150,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-200.jpg",
        fileSize: 6270,
        frameRate: null,
        height: 132,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 200,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-200.webp",
        fileSize: 4634,
        frameRate: null,
        height: 132,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 200,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-250.jpg",
        fileSize: 7297,
        frameRate: null,
        height: 166,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 250,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-250.webp",
        fileSize: 5066,
        frameRate: null,
        height: 166,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 250,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-300.jpg",
        fileSize: 8387,
        frameRate: null,
        height: 199,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 300,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-300.webp",
        fileSize: 5518,
        frameRate: null,
        height: 199,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 300,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-350.jpg",
        fileSize: 9503,
        frameRate: null,
        height: 232,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 350,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-350.webp",
        fileSize: 6014,
        frameRate: null,
        height: 232,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 350,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-400.jpg",
        fileSize: 10759,
        frameRate: null,
        height: 265,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 400,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-400.webp",
        fileSize: 6432,
        frameRate: null,
        height: 265,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 400,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-450.jpg",
        fileSize: 12385,
        frameRate: null,
        height: 298,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 450,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-450.webp",
        fileSize: 7040,
        frameRate: null,
        height: 298,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 450,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-500.jpg",
        fileSize: 14033,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/jpeg",
        width: 500,
      }, {
        bitRate: null,
        duration: null,
        fileName: "oldname-500.webp",
        fileSize: 7596,
        frameRate: null,
        height: 331,
        id: expect.toBeId("F"),
        mimetype: "image/webp",
        width: 500,
      }]),
    },

    filename: "oldname.jpg",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2018-08-22T18:51:25.800-07:00"),
    takenZone: "UTC-7",
    longitude: -121.517784,
    latitude: 45.715054,
    altitude: 28.4597,
    location: "Hood River Waterfront Park",
    city: "London",
    state: "Oregon",
    country: "USA",
    orientation: null,
    make: "NIKON CORPORATION",
    model: "NIKON D7000",
    lens: "18.0-200.0 mm f/3.5-5.6",
    photographer: "Dave Townsend",
    aperture: 11,
    shutterSpeed: "1/2000",
    iso: 400,
    focalLength: 95,
    rating: 4,

    albums: [],
    tags: [],
    people: [],
  });

  let mediaFile = fullMedia!.file!.id;

  let metadataFile = path.join(temp!.path, "local", "media1", mediaFile, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("reprocessed-metadata");

  expect(storeFileMock).toHaveBeenCalledTimes(19);
  expect(storeFileMock.mock.calls).toInclude([
    ["media1", mediaFile, "oldname-webp.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname-jpg.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-150.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-150.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname-200.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-200.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname-250.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-250.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname-300.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-300.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname-350.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-350.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname-400.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-400.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname-450.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-450.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname-500.jpg", expect.anything(), "image/jpeg"],
    ["media1", mediaFile, "oldname-500.webp", expect.anything(), "image/webp"],
    ["media1", mediaFile, "oldname.jpg", expect.anything(), "image/jpeg"],
  ]);

  expect(mockedEncodeVideo).not.toHaveBeenCalled();

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let buffer = buffers.get(`oldname-${size}.jpg`);
    expect(buffer).not.toBeUndefined();
    expect(await sharp(buffer).png().toBuffer()).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-jpg-${size}`,
    });

    buffer = buffers.get(`oldname-${size}.webp`);
    expect(buffer).not.toBeUndefined();
    expect(await sharp(buffer).png().toBuffer()).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-webp-${size}`,
    });
  }

  expect(deleteFile).not.toHaveBeenCalled();
  expect(deleteLocalFiles).not.toHaveBeenCalled();

  await purgeDeletedMedia();

  expect(deleteFile.mock.calls).toInclude([
    ["media1", "original1", "alt1.jpg"],
    ["media1", "original1", "alt2.jpg"],
    ["media1", "original1", "alt3.jpg"],
    ["media1", "original1", "orig1.jpg"],
  ]);

  expect(deleteLocalFiles.mock.calls).toInclude([
    ["media1", "original1"],
  ]);
});

test("purge", async (): Promise<void> => {
  await insertData({
    [Table.MediaInfo]: [{
      id: "media1",
      created: now(),
      deleted: false,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }, {
      id: "media2",
      created: now(),
      deleted: false,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }, {
      id: "media3",
      created: now(),
      deleted: true,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }, {
      id: "media4",
      created: now(),
      deleted: true,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }, {
      id: "media5",
      created: now(),
      deleted: false,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }],
    [Table.MediaFile]: [{
      id: "original1",
      media: "media1",
      uploaded: parseDateTime("2020-01-01T01:01:01Z"),
      processVersion: 2,
      fileName: "orig1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original2",
      media: "media1",
      uploaded: parseDateTime("2020-02-01T01:01:01Z"),
      processVersion: 2,
      fileName: "orig2.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original3",
      media: "media1",
      uploaded: parseDateTime("2020-03-01T01:01:01Z"),
      processVersion: 2,
      fileName: "orig3.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original4",
      media: "media2",
      uploaded: parseDateTime("2020-01-01T01:01:01Z"),
      processVersion: 2,
      fileName: "orig4.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original5",
      media: "media3",
      uploaded: parseDateTime("2020-01-01T01:01:01Z"),
      processVersion: 2,
      fileName: "orig5.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original6",
      media: "media3",
      uploaded: parseDateTime("2020-02-01T01:01:01Z"),
      processVersion: 2,
      fileName: "orig6.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }],
    [Table.AlternateFile]: [{
      id: "alternate1",
      mediaFile: "original1",
      type: AlternateFileType.Reencode,
      fileName: "alt1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate2",
      mediaFile: "original1",
      type: AlternateFileType.Reencode,
      fileName: "alt2.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate3",
      mediaFile: "original1",
      type: AlternateFileType.Thumbnail,
      fileName: "alt3.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate4",
      mediaFile: "original3",
      type: AlternateFileType.Reencode,
      fileName: "alt4.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate5",
      mediaFile: "original3",
      type: AlternateFileType.Reencode,
      fileName: "alt5.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate6",
      mediaFile: "original3",
      type: AlternateFileType.Thumbnail,
      fileName: "alt6.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate7",
      mediaFile: "original5",
      type: AlternateFileType.Reencode,
      fileName: "alt7.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate8",
      mediaFile: "original5",
      type: AlternateFileType.Reencode,
      fileName: "alt8.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate9",
      mediaFile: "original5",
      type: AlternateFileType.Thumbnail,
      fileName: "alt9.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate10",
      mediaFile: "original6",
      type: AlternateFileType.Reencode,
      fileName: "alt10.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate11",
      mediaFile: "original6",
      type: AlternateFileType.Reencode,
      fileName: "alt11.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate12",
      mediaFile: "original6",
      type: AlternateFileType.Thumbnail,
      fileName: "alt12.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }, {
      id: "alternate13",
      mediaFile: "original6",
      // @ts-ignore Intentionally incorrect.
      type: "foobar",
      fileName: "alt13.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
    }],
  });

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteFile = mockedFunction(storage.deleteFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteLocalFiles = mockedFunction(storage.deleteLocalFiles);

  await purgeDeletedMedia();

  expect(deleteFile.mock.calls).toInclude([
    ["media1", "original1", "alt1.jpg"],
    ["media1", "original1", "alt2.jpg"],
    ["media1", "original1", "alt3.jpg"],
    ["media1", "original1", "orig1.jpg"],
    ["media1", "original2", "orig2.jpg"],
    ["media3", "original5", "alt7.jpg"],
    ["media3", "original5", "alt8.jpg"],
    ["media3", "original5", "alt9.jpg"],
    ["media3", "original5", "orig5.jpg"],
    ["media3", "original6", "alt10.jpg"],
    ["media3", "original6", "alt11.jpg"],
    ["media3", "original6", "alt12.jpg"],
    ["media3", "original6", "alt13.jpg"],
    ["media3", "original6", "orig6.jpg"],
  ]);

  expect(deleteLocalFiles.mock.calls).toInclude([
    ["media1", "original1"],
    ["media1", "original2"],
    ["media3", "original5"],
    ["media3", "original6"],
    ["media3"],
    ["media4"],
  ]);
});
