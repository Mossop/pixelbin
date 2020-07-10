import moment, { Moment } from "moment-timezone";

import { expect, mockedFunction } from "../../test-helpers";
import { createMedia, fillMetadata, getMedia, createMediaInfo, editMedia } from "./media";
import { buildTestDB, insertTestData } from "./test-helpers";

jest.mock("moment-timezone", (): unknown => {
  const actualMoment = jest.requireActual("moment-timezone");
  let moment = jest.fn(actualMoment);
  // @ts-ignore: Mocking.
  moment.tz = jest.fn(actualMoment.tz);
  // @ts-ignore: Mocking.
  moment.isMoment = actualMoment.isMoment;
  return moment;
});

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

const mockedMoment = mockedFunction(moment);
const realMoment: typeof moment = jest.requireActual("moment-timezone");

test("Media tests", async (): Promise<void> => {
  await expect(createMedia("someone3@nowhere.com", "c1", fillMetadata({})))
    .rejects.toThrow("Invalid user or catalog passed to createMedia");

  let createdMoment: Moment = realMoment.tz("2016-01-01T23:35:01", "UTC");
  mockedMoment.mockImplementationOnce((): Moment => createdMoment);

  let newMedia = await createMedia("someone3@nowhere.com", "c3", fillMetadata({
    title: "My title",
  }));

  let id = newMedia.id;
  expect(newMedia).toEqual(fillMetadata({
    id: expect.stringMatching(/^M:[a-zA-Z0-9]+/),
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "My title",
  }));

  let foundMedia = await getMedia("someone3@nowhere.com", id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "My title", // Media set

    uploaded: null,
    mimetype: null,
    width: null,
    height: null,
    duration: null,
    fileSize: null,
  }));

  let uploadedMoment: Moment = realMoment.tz("2020-01-03T15:31:01", "UTC");
  mockedMoment.mockImplementationOnce((): Moment => uploadedMoment);

  let info = await createMediaInfo("someone3@nowhere.com", id, fillMetadata({
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,

    title: "Info title",
    photographer: "Me",
  }));

  expect(info).toEqual(fillMetadata({
    id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
    media: id,
    uploaded: expect.toEqualDate(uploadedMoment),
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,

    title: "Info title",
    photographer: "Me",
  }));

  foundMedia = await getMedia("someone3@nowhere.com", id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "My title", // Media set
    photographer: "Me", // MediaInfo set

    uploaded: expect.toEqualDate(uploadedMoment),
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    fileSize: 1000,
  }));

  await editMedia("someone3@nowhere.com", id, {
    title: null,
    city: "Portland",
  });

  foundMedia = await getMedia("someone3@nowhere.com", id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "Info title", // MediaInfo set
    photographer: "Me", // MediaInfo set
    city: "Portland", // Media set

    uploaded: expect.toEqualDate(uploadedMoment),
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    fileSize: 1000,
  }));

  let uploaded2Moment: Moment = realMoment.tz("2020-01-04T15:31:01", "UTC");
  mockedMoment.mockImplementationOnce((): Moment => uploaded2Moment);

  info = await createMediaInfo("someone3@nowhere.com", id, fillMetadata({
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 2000,

    title: "Different title",
    model: "Some model",
  }));

  expect(info).toEqual(fillMetadata({
    id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
    media: id,
    uploaded: expect.toEqualDate(uploaded2Moment),
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 2000,

    title: "Different title",
    model: "Some model",
  }));

  foundMedia = await getMedia("someone3@nowhere.com", id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "Different title", // MediaInfo set
    model: "Some model", // MediaInfo set
    city: "Portland", // Media set

    uploaded: expect.toEqualDate(uploaded2Moment),
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    fileSize: 2000,
  }));

  // Cannot create media in a catalog the user cannot access.
  await expect(createMedia("someone3@nowhere.com", "c1", fillMetadata({
    title: "My title",
  }))).rejects.toThrow("Invalid user or catalog passed to createMedia");

  newMedia = await createMedia("someone1@nowhere.com", "c1", fillMetadata({}));

  // Cannot add media info to media in a catalog the user cannot access.
  await expect(createMediaInfo("someone3@nowhere.com", newMedia.id, fillMetadata({
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
  }))).rejects.toThrow("Invalid user or catalog passed to createMediaInfo");

  // Cannot get media in a catalog the user cannot access.
  foundMedia = await getMedia("someone3@nowhere.com", newMedia.id);
  expect(foundMedia).toBeNull();
});
