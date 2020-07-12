import path from "path";

import { exiftool } from "exiftool-vendored";
import moment from "moment-timezone";
import sharp from "sharp";
import { dir as tmpdir, DirectoryResult } from "tmp-promise";

import { MEDIA_THUMBNAIL_SIZES } from "../../model/models";
import { mockedFunction, expect } from "../../test-helpers";
import { createMedia, fillMetadata, getMedia } from "../database";
import { insertTestData, buildTestDB } from "../database/test-helpers";
import { StorageService } from "../storage";
import { handleUploadedFile } from "./process";
import services, { provideService } from "./services";
import { setLogConfig } from "../../utils";

jest.mock("../storage");

buildTestDB();

beforeEach(insertTestData);

let temp: DirectoryResult | undefined;

beforeAll(async (): Promise<void> => {
  temp = await tmpdir({
    unsafeCleanup: true,
  });

  const storageService = new StorageService({
    tempDirectory: path.join(temp.path, "temp"),
    localDirectory: path.join(temp.path, "local"),
  });
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
  let temp = await tmpdir({
    unsafeCleanup: true,
  });

  const storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let uploaded = moment("2015-06-21T02:56:53");

  getUploadedFileMock.mockResolvedValueOnce({
    name: "Testname.jpg",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "lamppost.jpg"),
  });

  let media = await createMedia("someone1@nowhere.com", "c1", fillMetadata({
    city: "Portland",
  }));

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getLocalFilePathMock = mockedFunction(storage.getLocalFilePath);
  getLocalFilePathMock.mockImplementation(
    (media: string, mediaInfo: string, name: string): Promise<string> => {
      return Promise.resolve(path.join(temp.path, name));
    },
  );

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);

  let fullMedia = await getMedia("someone1@nowhere.com", media.id);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: media.created,

    uploaded: expect.toEqualDate(uploaded),
    mimetype: "image/jpeg",
    width: 500,
    height: 331,
    duration: null,
    frameRate: null,
    bitRate: null,
    fileSize: 55084,

    filename: "Testname.jpg",
    title: null,
    taken: expect.toEqualDate("2018-08-22T18:51:25.800-07:00"),
    timeZone: "America/Los_Angeles",
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
    exposure: 1,
    iso: 400,
    focalLength: 95,
  });

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(5);

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let expectedFile = path.join(temp.path, `thumb${size}.jpg`);
    let buffer = await sharp(expectedFile).png().toBuffer();
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: `lamppost-thumb-${size}`,
    });
  }

  await temp.cleanup();
});

test("Process video metadata", async (): Promise<void> => {
  let temp = await tmpdir({
    unsafeCleanup: true,
  });

  const storage = (await (await services.storage).getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  let uploaded = moment("2017-01-02T02:56:53");

  getUploadedFileMock.mockResolvedValueOnce({
    name: "Testvideo.mp4",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "video.mp4"),
  });

  let media = await createMedia("someone1@nowhere.com", "c1", fillMetadata({
  }));

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getLocalFilePathMock = mockedFunction(storage.getLocalFilePath);
  getLocalFilePathMock.mockImplementation(
    (media: string, mediaInfo: string, name: string): Promise<string> => {
      return Promise.resolve(path.join(temp.path, name));
    },
  );

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);

  let fullMedia = await getMedia("someone1@nowhere.com", media.id);
  expect(fullMedia).toEqual({
    id: media.id,
    catalog: "c1",
    created: media.created,

    uploaded: expect.toEqualDate(uploaded),
    fileSize: 4059609,
    width: 1920,
    height: 1080,
    mimetype: "video/mp4",
    duration: 1.74,
    bitRate: 18664868,
    frameRate: 59.202206,

    filename: "Testvideo.mp4",
    title: null,
    taken: expect.toEqualDate("2019-11-03T23:07:19-08:00"),
    timeZone: "America/Los_Angeles",
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
    exposure: null,
    iso: null,
    focalLength: null,
  });

  expect(getLocalFilePathMock).toHaveBeenCalledTimes(5);

  for (let size of MEDIA_THUMBNAIL_SIZES) {
    let expectedFile = path.join(temp.path, `thumb${size}.jpg`);
    let buffer = await sharp(expectedFile).png().toBuffer();
    expect(buffer).toMatchImageSnapshot({
      customSnapshotIdentifier: `video-thumb-${size}`,
    });
  }

  await temp.cleanup();
});
