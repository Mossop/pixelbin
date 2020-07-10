import path from "path";

import { exiftool } from "exiftool-vendored";
import moment from "moment-timezone";

import { expect } from "../../test-helpers";
import { parseFile, parseMetadata, getMediaInfo } from "./metadata";
import { provideService } from "./services";

jest.mock("../storage");

afterAll((): Promise<void> => exiftool.end());
provideService("exiftool", exiftool);

test("lamppost", async (): Promise<void> => {
  let uploaded = moment("2020-02-04T12:53:23");
  let data = await parseFile({
    name: "Testname.jpg",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "lamppost.jpg"),
  });

  expect(data).toMatchSnapshot({
    fileName: "Testname.jpg",
    fileSize: 55084,
    uploaded: expect.toEqualDate(uploaded),
    width: 500,
    height: 331,
    mimetype: "image/jpeg",
    duration: null,
    bitRate: null,
    frameRate: null,
  }, "lamppost-tags");

  let metadata = parseMetadata(data);
  expect(metadata).toEqual({
    filename: "Testname.jpg",
    title: null,
    taken: expect.toEqualDate("2018-08-22T18:51:25.800-07:00"),
    offset: -420,
    longitude: -121.517781666667,
    latitude: 45.7150516666667,
    altitude: 28.4597,
    location: "Hood River Waterfront Park",
    city: "Hood River",
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

  let info = getMediaInfo(data);
  expect(info).toEqual({
    uploaded: expect.toEqualDate(uploaded),
    mimetype: "image/jpeg",
    width: 500,
    height: 331,
    duration: null,
    frameRate: null,
    bitRate: null,
    fileSize: 55084,
  });
});

test("iptc", async (): Promise<void> => {
  let uploaded = moment("2019-12-03T12:30:23");
  let data = await parseFile({
    name: "IPTC.JPG",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "iptc.jpg"),
  });

  expect(data).toMatchSnapshot({
    fileName: "IPTC.JPG",
    fileSize: 91435,
    uploaded: expect.toEqualDate(uploaded),
    width: 1000,
    height: 500,
    mimetype: "image/jpeg",
    duration: null,
    bitRate: null,
    frameRate: null,
  }, "iptc-tags");

  let metadata = parseMetadata(data);
  expect(metadata).toEqual({
    filename: "IPTC.JPG",
    title: "The Title (ref2017.1)",
    taken: expect.toEqualDate("2017-07-13T10:01:00-07:00"),
    offset: null,
    longitude: null,
    latitude: null,
    altitude: null,
    location: "Sublocation (Core) (ref2017.1)",
    city: "City (Core) (ref2017.1)",
    state: "Province/State (Core) (ref2017.1)",
    country: "Country (Core) (ref2017.1)",
    orientation: null,
    make: null,
    model: null,
    lens: null,
    photographer: "Creator1 (ref2017.1), Creator2 (ref2017.1)",
    aperture: null,
    exposure: null,
    iso: null,
    focalLength: null,
  });

  let info = getMediaInfo(data);
  expect(info).toEqual({
    uploaded: expect.toEqualDate(uploaded),
    mimetype: "image/jpeg",
    width: 1000,
    height: 500,
    duration: null,
    frameRate: null,
    bitRate: null,
    fileSize: 91435,
  });
});

test("video", async (): Promise<void> => {
  let uploaded = moment("2010-01-03T09:30:23");
  let tags = await parseFile({
    name: "test_video.foo",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "video.mp4"),
  });

  expect(tags).toMatchSnapshot({
    fileName: "test_video.foo",
    fileSize: 4059609,
    uploaded: expect.toEqualDate(uploaded),
    width: 1920,
    height: 1080,
    mimetype: "video/mp4",
    duration: 1.74,
    bitRate: 18664868,
    frameRate: 59.202207150247155,
  }, "video-tags");

  let metadata = parseMetadata(tags);
  expect(metadata).toEqual({
    filename: "test_video.foo",
    title: null,
    taken: expect.toEqualDate("2019-11-03T23:07:19-08:00"),
    offset: -480,
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
});
