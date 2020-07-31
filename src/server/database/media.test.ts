import moment, { Moment } from "moment-timezone";

import { AlternateFileType } from "../../model";
import { expect, mockedFunction } from "../../test-helpers";
import { createMedia, fillMetadata, getMedia, editMedia, listAlternateFiles } from "./media";
import { buildTestDB, insertTestData } from "./test-helpers";
import { Tables, DBAPI } from "./types";
import { withNewUploadedMedia, UploadedMediaInfo, addAlternateFile } from "./unsafe";

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

function createUploadedMedia(
  media: DBAPI<Tables.UploadedMedia>["media"],
  data: DBAPI<Omit<Tables.UploadedMedia, "id" | "media">>,
): Promise<UploadedMediaInfo> {
  return withNewUploadedMedia(
    media,
    data,
    (uploadedMedia: UploadedMediaInfo): Promise<UploadedMediaInfo> =>
      Promise.resolve(uploadedMedia),
  );
}

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
    bitRate: null,
    frameRate: null,
  }));

  let uploadedMoment: Moment = realMoment.tz("2020-01-03T15:31:01", "UTC");

  let info = await createUploadedMedia(id, fillMetadata({
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
    processVersion: 5,
    uploaded: uploadedMoment,
    fileName: "biz.jpg",

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
    fileName: "biz.jpg",

    title: "Info title",
    photographer: "Me",
  }));

  foundMedia = await getMedia("someone3@nowhere.com", id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "My title", // Media set
    photographer: "Me", // UploadedMediaInfo set

    uploaded: expect.toEqualDate(uploadedMoment),
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
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

    title: "Info title", // UploadedMediaInfo set
    photographer: "Me", // UploadedMediaInfo set
    city: "Portland", // Media set

    uploaded: expect.toEqualDate(uploadedMoment),
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
  }));

  let uploaded2Moment: Moment = realMoment.tz("2020-01-04T15:31:01", "UTC");
  mockedMoment.mockImplementationOnce((): Moment => uploaded2Moment);

  info = await createUploadedMedia(id, fillMetadata({
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 2000,
    processVersion: 5,
    uploaded: uploaded2Moment,
    fileName: "bar.jpg",

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
    fileName: "bar.jpg",

    title: "Different title",
    model: "Some model",
  }));

  foundMedia = await getMedia("someone3@nowhere.com", id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "Different title", // UploadedMediaInfo set
    model: "Some model", // UploadedMediaInfo set
    city: "Portland", // Media set

    uploaded: expect.toEqualDate(uploaded2Moment),
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 2000,
  }));

  await addAlternateFile(info.id, {
    type: AlternateFileType.Thumbnail,
    fileName: "thumb.webp",
    fileSize: 200,
    mimetype: "image/webp",
    width: 600,
    height: 300,
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  await addAlternateFile(info.id, {
    type: AlternateFileType.Thumbnail,
    fileName: "thumb.jpg",
    fileSize: 400,
    mimetype: "image/jpeg",
    width: 500,
    height: 300,
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  await addAlternateFile(info.id, {
    type: AlternateFileType.Poster,
    fileName: "poster.jpg",
    fileSize: 300,
    mimetype: "image/jpeg",
    width: 200,
    height: 100,
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  let list = await listAlternateFiles("someone3@nowhere.com", id, AlternateFileType.Thumbnail);
  list.sort(
    (a: DBAPI<Tables.AlternateFile>, b: DBAPI<Tables.AlternateFile>): number => a.width - b.width,
  );
  expect(list).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    uploadedMedia: info.id,
    type: AlternateFileType.Thumbnail,
    fileName: "thumb.jpg",
    fileSize: 400,
    mimetype: "image/jpeg",
    width: 500,
    height: 300,
    duration: null,
    frameRate: null,
    bitRate: null,
  }, {
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    uploadedMedia: info.id,
    type: AlternateFileType.Thumbnail,
    fileName: "thumb.webp",
    fileSize: 200,
    mimetype: "image/webp",
    width: 600,
    height: 300,
    duration: null,
    frameRate: null,
    bitRate: null,
  }]);

  list = await listAlternateFiles("someone3@nowhere.com", id, AlternateFileType.Poster);
  list.sort(
    (a: DBAPI<Tables.AlternateFile>, b: DBAPI<Tables.AlternateFile>): number => a.width - b.width,
  );
  expect(list).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    uploadedMedia: info.id,
    type: AlternateFileType.Poster,
    fileName: "poster.jpg",
    fileSize: 300,
    mimetype: "image/jpeg",
    width: 200,
    height: 100,
    duration: null,
    frameRate: null,
    bitRate: null,
  }]);

  // Cannot create media in a catalog the user cannot access.
  await expect(createMedia("someone3@nowhere.com", "c1", fillMetadata({
    title: "My title",
  }))).rejects.toThrow("Invalid user or catalog passed to createMedia");

  newMedia = await createMedia("someone1@nowhere.com", "c1", fillMetadata({}));

  // Cannot add media info to a missing media.
  await expect(createUploadedMedia("biz", fillMetadata({
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
    processVersion: 5,
    uploaded: moment(),
    fileName: "foo.jpg",
  }))).rejects.toThrow("violates foreign key constraint");

  // Cannot get media in a catalog the user cannot access.
  foundMedia = await getMedia("someone3@nowhere.com", newMedia.id);
  expect(foundMedia).toBeNull();

  // Cannot list alternates for media the user cannot access.
  list = await listAlternateFiles("someone2@nowhere.com", id, AlternateFileType.Poster);
  expect(list).toHaveLength(0);
});
