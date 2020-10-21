import { promises as fs } from "fs";
import path from "path";

import { exiftool } from "exiftool-vendored";
import sharp from "sharp";
import { dir as tmpdir, DirectoryResult } from "tmp-promise";

import { AlternateFileType, emptyMetadata } from "../../model";
import { mockedFunction, expect, lastCallArgs, mockDateTime } from "../../test-helpers";
import { setLogConfig, now } from "../../utils";
import { parseDateTime } from "../../utils/__mocks__/datetime";
import { connection, insertTestData, buildTestDB, insertData } from "../database/test-helpers";
import { Table } from "../database/types";
import { AlternateFile } from "../database/types/tables";
import { OriginalInfo } from "../database/unsafe";
import { StorageService } from "../storage";
import { encodeVideo, AudioCodec, VideoCodec, Container, VideoInfo } from "./ffmpeg";
import { handleUploadedFile, MEDIA_THUMBNAIL_SIZES, purgeDeletedMedia } from "./process";
import services, { provideService } from "./services";

/* eslint-disable */
jest.mock("../storage");
jest.mock("../../utils/datetime");
jest.mock("./ffmpeg", () => {
  let actual = jest.requireActual("./ffmpeg");
  return {
    ...actual,
    encodeVideo: jest.fn(() => Promise.resolve()),
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

  const storageService = new StorageService({
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

  const storage = (await (await services.storage).getStorage("")).get();

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

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);

  let [fullMedia] = await user1Db.getMedia([media.id]);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(uploaded),

    uploaded: expect.toEqualDate(uploaded),
    mimetype: "image/jpeg",
    width: 500,
    height: 331,
    duration: null,
    frameRate: null,
    bitRate: null,
    fileSize: 55084,
    fileName: "Testname.jpg",
    original: expect.stringMatching(/^I:[a-zA-Z0-9]+/),

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

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(6);

  let metadataFile = path.join(temp.path, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("lamppost-metadata");

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let expectedFile = path.join(temp.path, `Testname-${size}.jpg`);
    let buffer = await sharp(expectedFile).png().toBuffer();
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-${size}`,
    });
  }

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

  expect(thumbnails).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-150.jpg",
    fileSize: 2883,
    mimetype: "image/jpeg",
    width: 150,
    height: 99,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-200.jpg",
    fileSize: 3997,
    mimetype: "image/jpeg",
    width: 200,
    height: 132,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-300.jpg",
    fileSize: 7328,
    mimetype: "image/jpeg",
    width: 300,
    height: 199,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-400.jpg",
    fileSize: 11198,
    mimetype: "image/jpeg",
    width: 400,
    height: 265,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-500.jpg",
    fileSize: 17336,
    mimetype: "image/jpeg",
    width: 500,
    height: 331,
    frameRate: null,
    bitRate: null,
    duration: null,
  }]);

  expect(storeFileMock).toHaveBeenCalledTimes(1);
  expect(storeFileMock).toHaveBeenLastCalledWith(
    media.id,
    expect.anything(),
    "Testname.jpg",
    sourceFile,
  );

  expect(mockedEncodeVideo).not.toHaveBeenCalled();

  await temp.cleanup();
});

test("Process video metadata", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let temp = await tmpdir({
    unsafeCleanup: true,
  });

  const storage = (await (await services.storage).getStorage("")).get();

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

  mockedEncodeVideo.mockImplementationOnce((): Promise<VideoInfo> => Promise.resolve({
    format: {
      duration: 100,
      bitRate: 1000000,
      container: Container.Matroska,
      size: 2000000,
    },
    videoStream: {
      codec: VideoCodec.AV1,
      frameRate: 30,
      width: 1920,
      height: 1080,
    },
    audioStream: {
      codec: AudioCodec.Vorbis,
    },
  }));

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);

  let [fullMedia] = await user1Db.getMedia([media.id]);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(uploaded),

    uploaded: expect.toEqualDate(uploaded),
    fileSize: 4059609,
    width: 1920,
    height: 1080,
    mimetype: "video/mp4",
    duration: 1.74,
    bitRate: 18664868,
    frameRate: 59.202206,
    fileName: "Testvideo.mp4",
    original: expect.stringMatching(/^I:[a-zA-Z0-9]+/),

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

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(6);

  let metadataFile = path.join(temp.path, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("video-metadata");

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let expectedFile = path.join(temp.path, `Testvideo-${size}.jpg`);
    let buffer = await sharp(expectedFile).png().toBuffer();
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: `video-thumb-${size}`,
    });
  }

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

  expect(thumbnails).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testvideo-150.jpg",
    fileSize: 4810,
    mimetype: "image/jpeg",
    width: 84,
    height: 150,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testvideo-200.jpg",
    fileSize: 7570,
    mimetype: "image/jpeg",
    width: 113,
    height: 200,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testvideo-300.jpg",
    fileSize: 14955,
    mimetype: "image/jpeg",
    width: 169,
    height: 300,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testvideo-400.jpg",
    fileSize: 23721,
    mimetype: "image/jpeg",
    width: 225,
    height: 400,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testvideo-500.jpg",
    fileSize: 34910,
    mimetype: "image/jpeg",
    width: 281,
    height: 500,
    frameRate: null,
    bitRate: null,
    duration: null,
  }]);

  let encodes = await user1Db.listAlternateFiles(
    media.id,
    AlternateFileType.Reencode,
  );
  expect(encodes).toHaveLength(1);

  expect(encodes).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Reencode,
    fileName: "Testvideo-h264.mp4",
    fileSize: 2000000,
    mimetype: "video/mkv",
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
    original: fullMedia!["original"],
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

  expect(storeFileMock).toHaveBeenCalledTimes(3);
  expect(storeFileMock.mock.calls).toEqual([
    [media.id, expect.anything(), "Testvideo-poster.jpg", expect.anything()],
    [media.id, storeFileMock.mock.calls[0][1], "Testvideo.mp4", sourceFile],
    [media.id, storeFileMock.mock.calls[0][1], "Testvideo-h264.mp4", lastEncodeArgs[4]],
  ]);

  await temp.cleanup();
});

test("reprocess", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");

  let temp = await tmpdir({
    unsafeCleanup: true,
  });

  const storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let created = mockDateTime("2018-01-01T02:56:53");

  let media = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    photographer: "Dave",
  });

  let originalUploaded = parseDateTime("2020-01-01T02:56:53");

  let original = await dbConnection.withNewOriginal(media.id, {
    ...emptyMetadata,
    processVersion: 1,
    city: "London",
    uploaded: originalUploaded,
    fileName: "old.jpg",
    fileSize: 1000,
    mimetype: "image/jpeg",
    width: 100,
    height: 200,
    duration: null,
    frameRate: null,
    bitRate: null,
  }, async (_: unknown, original: OriginalInfo): Promise<OriginalInfo> => original);

  let [foundMedia] = await user1Db.getMedia([media.id]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id: media.id,
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(originalUploaded),
    catalog: "c1",
    uploaded: expect.toEqualDate(originalUploaded),
    fileSize: 1000,
    fileName: "old.jpg",
    original: original.id,
    mimetype: "image/jpeg",
    width: 100,
    height: 200,
    duration: null,
    frameRate: null,
    bitRate: null,
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

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);

  let [fullMedia] = await user1Db.getMedia([media.id]);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: expect.toEqualDate(created),
    updated: expect.toEqualDate(uploaded),

    uploaded: expect.toEqualDate(uploaded),
    mimetype: "image/jpeg",
    width: 500,
    height: 331,
    duration: null,
    frameRate: null,
    bitRate: null,
    fileSize: 55084,
    fileName: "Testname.jpg",
    original: expect.stringMatching(/^I:[a-zA-Z0-9]+/),

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

  expect(fullMedia!["original"]).not.toBe(original.id);

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(6);

  let metadataFile = path.join(temp.path, "metadata.json");
  let contents = JSON.parse(await fs.readFile(metadataFile, {
    encoding: "utf8",
  }));
  expect(contents).toMatchSnapshot("reprocessed-metadata");

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let expectedFile = path.join(temp.path, `Testname-${size}.jpg`);
    let buffer = await sharp(expectedFile).png().toBuffer();
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-${size}`,
    });
  }

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

  expect(thumbnails).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-150.jpg",
    fileSize: 2883,
    mimetype: "image/jpeg",
    width: 150,
    height: 99,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-200.jpg",
    fileSize: 3997,
    mimetype: "image/jpeg",
    width: 200,
    height: 132,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-300.jpg",
    fileSize: 7328,
    mimetype: "image/jpeg",
    width: 300,
    height: 199,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-400.jpg",
    fileSize: 11198,
    mimetype: "image/jpeg",
    width: 400,
    height: 265,
    frameRate: null,
    bitRate: null,
    duration: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: fullMedia!["original"],
    type: AlternateFileType.Thumbnail,
    fileName: "Testname-500.jpg",
    fileSize: 17336,
    mimetype: "image/jpeg",
    width: 500,
    height: 331,
    frameRate: null,
    bitRate: null,
    duration: null,
  }]);

  expect(storeFileMock).toHaveBeenCalledTimes(1);
  expect(storeFileMock).toHaveBeenLastCalledWith(
    media.id,
    expect.anything(),
    "Testname.jpg",
    sourceFile,
  );

  expect(mockedEncodeVideo).not.toHaveBeenCalled();

  await temp.cleanup();
});

test("purge", async (): Promise<void> => {
  await insertData({
    [Table.Media]: [{
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
    [Table.Original]: [{
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
      original: "original1",
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
      original: "original1",
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
      original: "original1",
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
      original: "original3",
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
      original: "original3",
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
      original: "original3",
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
      original: "original5",
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
      original: "original5",
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
      original: "original5",
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
      original: "original6",
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
      original: "original6",
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
      original: "original6",
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

  const storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteFile = mockedFunction(storage.deleteFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteLocalFiles = mockedFunction(storage.deleteLocalFiles);

  await purgeDeletedMedia();

  expect(deleteFile.mock.calls).toInclude([
    ["media1", "original1", "alt1.jpg"],
    ["media1", "original1", "alt2.jpg"],
    ["media1", "original1", "orig1.jpg"],
    ["media1", "original2", "orig2.jpg"],
    ["media3", "original5", "alt7.jpg"],
    ["media3", "original5", "alt8.jpg"],
    ["media3", "original5", "orig5.jpg"],
    ["media3", "original6", "alt10.jpg"],
    ["media3", "original6", "alt11.jpg"],
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
