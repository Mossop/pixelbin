import path from "path";

import { exiftool } from "exiftool-vendored";
import moment from "moment-timezone";

import { mockedFunction, expect } from "../../test-helpers";
import { createMedia, fillMetadata, getMedia } from "../database";
import { insertTestData, buildTestDB } from "../database/test-helpers";
import { StorageService } from "../storage";
import { handleUploadedFile } from "./process";
import { provideService } from "./services";

jest.mock("../storage");

buildTestDB();

beforeEach(insertTestData);

afterAll((): Promise<void> => exiftool.end());
provideService("exiftool", exiftool);

test("Process metadata", async (): Promise<void> => {
  const storageService = new StorageService({
    tempDirectory: "",
    localDirectory: "",
  });
  provideService("storage", storageService);
  const storage = (await storageService.getStorage("")).get();

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
});
