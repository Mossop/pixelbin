import path from "path";

import { exiftool } from "exiftool-vendored";

import { expect } from "../../test-helpers";
import { parseDateTime } from "../../utils";
import { parseFile, parseMetadata, getMediaFile } from "./metadata";
import { provideService } from "./services";

jest.mock("../storage");

afterAll((): Promise<void> => exiftool.end());
provideService("exiftool", exiftool);

test("lamppost", async (): Promise<void> => {
  let uploaded = parseDateTime("2020-02-04T12:53:23Z");
  let data = await parseFile({
    catalog: "foo",
    media: "bar",
    name: "Testname.jpg",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "lamppost.jpg"),
  });
  // This field is problematic and not important.
  delete data.exif.TimeCreated;

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
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2018-08-22T18:51:25.800-07:00"),
    takenZone: null,
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
    shutterSpeed: "1/2000",
    iso: 400,
    focalLength: 95,
    rating: 4,
  });
  expect(metadata.taken?.hour).toBe(18);

  let info = getMediaFile(data);
  expect(info).toEqual({
    uploaded: expect.toEqualDate(uploaded),
    mimetype: "image/jpeg",
    fileName: "Testname.jpg",
    width: 500,
    height: 331,
    duration: null,
    frameRate: null,
    bitRate: null,
    fileSize: 55084,
  });
});

test("iptc", async (): Promise<void> => {
  let uploaded = parseDateTime("2019-12-03T12:30:23Z");
  let data = await parseFile({
    catalog: "foo",
    media: "bar",
    name: "IPTC.JPG",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "iptc.jpg"),
  });
  // This field is problematic and not important.
  delete data.exif.TimeCreated;

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
    description: "The description aka caption (ref2017.1)",
    category: null,
    label: null,
    taken: expect.toEqualDate("2017-07-13T17:01:00Z"),
    takenZone: null,
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
    shutterSpeed: null,
    iso: null,
    focalLength: null,
    rating: 1,
  });
  expect(metadata.taken?.hour).toBe(17);

  let info = getMediaFile(data);
  expect(info).toEqual({
    uploaded: expect.toEqualDate(uploaded),
    mimetype: "image/jpeg",
    fileName: "IPTC.JPG",
    width: 1000,
    height: 500,
    duration: null,
    frameRate: null,
    bitRate: null,
    fileSize: 91435,
  });
});

test("rotated", async (): Promise<void> => {
  let uploaded = parseDateTime("2010-06-03T12:30:23Z");
  let data = await parseFile({
    catalog: "foo",
    media: "bar",
    name: "rotated.jpg",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "rotated.jpg"),
  });
  // This field is problematic and not important.
  delete data.exif.TimeCreated;

  expect(data).toMatchSnapshot({
    fileName: "rotated.jpg",
    fileSize: 83275,
    uploaded: expect.toEqualDate(uploaded),
    width: 200,
    height: 300,
    mimetype: "image/jpeg",
    duration: null,
    bitRate: null,
    frameRate: null,
  }, "rotated-tags");

  let metadata = parseMetadata(data);
  expect(metadata).toEqual({
    filename: "rotated.jpg",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2017-07-04T09:29:49.660-08:00"),
    takenZone: null,
    longitude: -111.772536111667,
    latitude: 40.3928666666667,
    altitude: 1451.8272,
    location: null,
    city: "American Fork",
    state: "Utah",
    country: "USA",
    orientation: null,
    make: "Canon",
    model: "Canon EOS REBEL T3i",
    lens: null,
    photographer: null,
    aperture: 5,
    shutterSpeed: "1/80",
    iso: 100,
    focalLength: 42,
    rating: 4,
  });
  expect(metadata.taken?.hour).toBe(9);

  let info = getMediaFile(data);
  expect(info).toEqual({
    uploaded: expect.toEqualDate(uploaded),
    mimetype: "image/jpeg",
    fileName: "rotated.jpg",
    width: 200,
    height: 300,
    duration: null,
    frameRate: null,
    bitRate: null,
    fileSize: 83275,
  });
});

test("video", async (): Promise<void> => {
  let uploaded = parseDateTime("2010-01-03T09:30:23Z");
  let data = await parseFile({
    catalog: "foo",
    media: "bar",
    name: "test_video.foo",
    uploaded,
    path: path.join(__dirname, "..", "..", "..", "testdata", "video.mp4"),
  });
  // This field is problematic and not important.
  delete data.exif.TimeCreated;

  expect(data).toMatchSnapshot({
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

  let metadata = parseMetadata(data);
  expect(metadata).toEqual({
    filename: "test_video.foo",
    title: null,
    description: null,
    category: null,
    label: null,
    taken: expect.toEqualDate("2019-11-03T23:07:19-08:00"),
    takenZone: null,
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
  });
  expect(metadata.taken?.hour).toBe(23);

  let info = getMediaFile(data);
  expect(info).toEqual({
    uploaded: expect.toEqualDate(uploaded),
    mimetype: "video/mp4",
    fileName: "test_video.foo",
    width: 1920,
    height: 1080,
    duration: 1.74,
    frameRate: 59.202207150247155,
    bitRate: 18664868,
    fileSize: 4059609,
  });
});
