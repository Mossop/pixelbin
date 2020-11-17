import { promises as fs } from "fs";
import path from "path";

import { exiftool } from "exiftool-vendored";
import sharp from "sharp";
import type { DirectoryResult } from "tmp-promise";
import { dir as tmpdir } from "tmp-promise";

import { AlternateFileType, emptyMetadata } from "../../model";
import { mockedFunction, expect, lastCallArgs, mockDateTime } from "../../test-helpers";
import { now } from "../../utils";
import { parseDateTime } from "../../utils/__mocks__/datetime";
import { connection, insertTestData, buildTestDB, insertData } from "../database/test-helpers";
import { Table } from "../database/types";
import type { AlternateFile, MediaFile } from "../database/types/tables";
import { StorageService } from "../storage";
import type { VideoInfo } from "./ffmpeg";
import { encodeVideo, AudioCodec, VideoCodec, Container } from "./ffmpeg";
import { handleUploadedFile, MEDIA_THUMBNAIL_SIZES, purgeDeletedMedia } from "./process";
import services, { provideService } from "./services";

/* eslint-disable */
jest.mock("../storage");
jest.mock("../../utils/datetime");
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

  let temp = await tmpdir({
    unsafeCleanup: true,
  });

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let created = mockDateTime("2014-06-21T02:56:53");
  let uploaded = parseDateTime("2015-06-21T02:56:53");
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
    (media: string, original: string, name: string): Promise<string> => {
      return Promise.resolve(path.join(temp.path, name));
    },
  );

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);

  let buffers: Buffer[] = [];
  storeFileMock.mockImplementation(
    async (media: string, mediaFile: string, filename: string, source: string): Promise<void> => {
      buffers.push(await fs.readFile(source));
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
      processVersion: 1,
      mimetype: "image/jpeg",
      width: 500,
      height: 331,
      duration: null,
      frameRate: null,
      bitRate: null,
      fileSize: 55084,
      fileName: "Testname.jpg",
      id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
    },

    filename: "Testname.jpg",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2018-08-22T18:51:25.800-07:00"),
    takenZone: "-07:00",
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

  let metadataFile = path.join(temp.path, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("lamppost-metadata");

  let thumbnails = await user1Db.listAlternateFiles(
    media.id,
    AlternateFileType.Thumbnail,
  );
  expect(thumbnails).toHaveLength(MEDIA_THUMBNAIL_SIZES.length);
  thumbnails.sort((a: AlternateFile, b: AlternateFile): number => {
    return a.width - b.width;
  });

  expect(
    thumbnails.map((t: AlternateFile): number => t.width),
  ).toEqual(MEDIA_THUMBNAIL_SIZES);

  let staticProperties = thumbnails.map((thumbnail: AlternateFile): unknown => {
    let { id, mediaFile, ...rest } = thumbnail;
    return rest;
  });

  expect(staticProperties).toMatchSnapshot();

  let { mediaFile } = thumbnails[0];

  expect(storeFileMock).toHaveBeenCalledTimes(9);
  expect(storeFileMock.mock.calls).toEqual([
    [media.id, mediaFile, "Testname-150.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-200.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-250.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-300.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-350.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-400.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-450.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-500.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname.jpg", sourceFile, "image/jpeg"],
  ]);

  expect(mockedEncodeVideo).not.toHaveBeenCalled();

  for (let i = 0; i < MEDIA_THUMBNAIL_SIZES.length; i++) {
    let buffer = await sharp(buffers[i]).png().toBuffer();
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-${MEDIA_THUMBNAIL_SIZES[i]}`,
    });
  }

  await temp.cleanup();
});

test("Process image fails", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let temp = await tmpdir({
    unsafeCleanup: true,
  });

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let created = mockDateTime("2014-06-21T02:56:53");
  let uploaded = parseDateTime("2015-06-21T02:56:53");
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
    (media: string, original: string, name: string): Promise<string> => {
      return Promise.resolve(path.join(temp.path, name));
    },
  );

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);
  storeFileMock.mockRejectedValueOnce(new Error("Failed to upload file."));

  await expect(handleUploadedFile(media.id)).rejects.toThrow("Failed to upload file.");

  expect(storeFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).not.toHaveBeenCalled();

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

  await temp.cleanup();
});

test("Process video metadata", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let temp = await tmpdir({
    unsafeCleanup: true,
  });

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let uploaded = parseDateTime("2017-01-02T02:56:53");
  let sourceFile = path.join(__dirname, "..", "..", "..", "testdata", "video.mp4");

  let created = mockDateTime("2016-01-02T02:56:53");
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
    (media: string, original: string, name: string): Promise<string> => {
      return Promise.resolve(path.join(temp.path, name));
    },
  );

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);

  let buffers: Buffer[] = [];
  storeFileMock.mockImplementation(
    async (media: string, mediaFile: string, filename: string, source: string): Promise<void> => {
      buffers.push(await fs.readFile(source));
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
      processVersion: 1,
      fileSize: 4059609,
      width: 1920,
      height: 1080,
      mimetype: "video/mp4",
      duration: 1.74,
      bitRate: 18664868,
      frameRate: 59.202206,
      fileName: "Testvideo.mp4",
      id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
    },

    filename: "Testvideo.mp4",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2019-11-03T23:07:19-08:00"),
    takenZone: "-08:00",
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

  let metadataFile = path.join(temp.path, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("video-metadata");

  let thumbnails = await user1Db.listAlternateFiles(
    media.id,
    AlternateFileType.Thumbnail,
  );
  expect(thumbnails).toHaveLength(MEDIA_THUMBNAIL_SIZES.length);
  thumbnails.sort((a: AlternateFile, b: AlternateFile): number => {
    return a.height - b.height;
  });

  expect(
    thumbnails.map((t: AlternateFile): number => t.height),
  ).toEqual(MEDIA_THUMBNAIL_SIZES);

  let staticProperties = thumbnails.map((thumbnail: AlternateFile): unknown => {
    let { id, mediaFile, ...rest } = thumbnail;
    return rest;
  });

  expect(staticProperties).toMatchSnapshot();

  let encodes = await user1Db.listAlternateFiles(
    media.id,
    AlternateFileType.Reencode,
  );
  expect(encodes).toHaveLength(1);

  expect(encodes).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    mediaFile: fullMedia?.file?.id,
    type: AlternateFileType.Reencode,
    fileName: "Testvideo-h264.mp4",
    fileSize: 2000000,
    mimetype: "video/mp4",
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitRate: 1000000,
    duration: 100,
  }]);

  let posters = await user1Db.listAlternateFiles(
    media.id,
    AlternateFileType.Poster,
  );
  expect(posters).toHaveLength(1);

  expect(posters).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    mediaFile: fullMedia?.file?.id,
    type: AlternateFileType.Poster,
    fileName: "Testvideo-poster.jpg",
    fileSize: expect.toBeBetween(140000, 160000),
    mimetype: "image/jpeg",
    width: 1080,
    height: 1920,
    frameRate: null,
    bitRate: null,
    duration: null,
  }]);

  expect(mockedEncodeVideo).toHaveBeenCalledTimes(1);
  let lastEncodeArgs = lastCallArgs(mockedEncodeVideo);
  expect(lastEncodeArgs).toEqual([
    sourceFile,
    VideoCodec.H264,
    AudioCodec.AAC,
    Container.MP4,
    expect.anything(),
  ]);

  let mediaFile = posters[0].mediaFile;

  expect(storeFileMock).toHaveBeenCalledTimes(11);
  expect(storeFileMock.mock.calls).toEqual([
    [media.id, mediaFile, "Testvideo-poster.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-150.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-200.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-250.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-300.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-350.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-400.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-450.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo-500.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testvideo.mp4", sourceFile, "video/mp4"],
    [media.id, mediaFile, "Testvideo-h264.mp4", lastEncodeArgs[4], "video/mp4"],
  ]);

  for (let i = 0; i < MEDIA_THUMBNAIL_SIZES.length; i++) {
    let buffer = await sharp(buffers[i + 1]).png().toBuffer();
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: `video-thumb-${MEDIA_THUMBNAIL_SIZES[i]}`,
    });
  }

  await temp.cleanup();
});

test("reprocess", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let temp = await tmpdir({
    unsafeCleanup: true,
  });

  let storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let created = mockDateTime("2018-01-01T02:56:53");

  let media = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    photographer: "Dave",
  });

  let fileUploaded = parseDateTime("2020-01-01T02:56:53");

  let oldMediaFile = await dbConnection.withNewMediaFile(media.id, {
    ...emptyMetadata,
    processVersion: 1,
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
  }, async (_: unknown, mediaFile: MediaFile): Promise<MediaFile> => mediaFile);

  let [foundMedia] = await user1Db.getMedia([media.id]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id: media.id,
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(fileUploaded),
    catalog: "c1",

    file: {
      processVersion: 1,
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
    },

    city: "London",
    photographer: "Dave",
    albums: [],
    people: [],
    tags: [],
  });

  let uploaded = parseDateTime("2020-01-02T02:56:53");
  let sourceFile = path.join(__dirname, "..", "..", "..", "testdata", "lamppost.jpg");

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
    (media: string, original: string, name: string): Promise<string> => {
      return Promise.resolve(path.join(temp.path, name));
    },
  );

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let storeFileMock = mockedFunction(storage.storeFile);

  let buffers: Buffer[] = [];
  storeFileMock.mockImplementation(
    async (media: string, mediaFile: string, filename: string, source: string): Promise<void> => {
      buffers.push(await fs.readFile(source));
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
      processVersion: 1,
      uploaded: expect.toEqualDate(uploaded),
      mimetype: "image/jpeg",
      width: 500,
      height: 331,
      duration: null,
      frameRate: null,
      bitRate: null,
      fileSize: 55084,
      fileName: "Testname.jpg",
      id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
    },

    filename: "Testname.jpg",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2018-08-22T18:51:25.800-07:00"),
    takenZone: "-07:00",
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

  expect(fullMedia?.file?.id).not.toBe(oldMediaFile.id);

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(1);

  let metadataFile = path.join(temp.path, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("reprocessed-metadata");

  let thumbnails = await user1Db.listAlternateFiles(
    media.id,
    AlternateFileType.Thumbnail,
  );
  expect(thumbnails).toHaveLength(MEDIA_THUMBNAIL_SIZES.length);
  thumbnails.sort((a: AlternateFile, b: AlternateFile): number => {
    return a.width - b.width;
  });

  expect(
    thumbnails.map((t: AlternateFile): number => t.width),
  ).toEqual(MEDIA_THUMBNAIL_SIZES);

  let staticProperties = thumbnails.map((thumbnail: AlternateFile): unknown => {
    let { id, mediaFile, ...rest } = thumbnail;
    return rest;
  });

  expect(staticProperties).toMatchSnapshot();

  let { mediaFile } = thumbnails[0];

  expect(storeFileMock).toHaveBeenCalledTimes(9);
  expect(storeFileMock.mock.calls).toEqual([
    [media.id, mediaFile, "Testname-150.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-200.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-250.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-300.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-350.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-400.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-450.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname-500.jpg", expect.anything(), "image/jpeg"],
    [media.id, mediaFile, "Testname.jpg", sourceFile, "image/jpeg"],
  ]);

  expect(mockedEncodeVideo).not.toHaveBeenCalled();

  for (let i = 0; i < MEDIA_THUMBNAIL_SIZES.length; i++) {
    let buffer = await sharp(buffers[i]).png().toBuffer();
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-${MEDIA_THUMBNAIL_SIZES[i]}`,
    });
  }

  await temp.cleanup();
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
      uploaded: parseDateTime("2020-01-01T01:01:01"),
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
    }, {
      id: "original2",
      media: "media1",
      uploaded: parseDateTime("2020-02-01T01:01:01"),
      processVersion: 1,
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
      uploaded: parseDateTime("2020-03-01T01:01:01"),
      processVersion: 1,
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
      uploaded: parseDateTime("2020-01-01T01:01:01"),
      processVersion: 1,
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
      uploaded: parseDateTime("2020-01-01T01:01:01"),
      processVersion: 1,
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
      uploaded: parseDateTime("2020-02-01T01:01:01"),
      processVersion: 1,
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
      type: AlternateFileType.Poster,
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
      type: AlternateFileType.Poster,
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
      type: AlternateFileType.Poster,
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
      type: AlternateFileType.Poster,
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
