import moment, { Moment } from "moment-timezone";

import { AlternateFileType } from "../../model";
import { expect, mockedFunction } from "../../test-helpers";
import { DatabaseConnection } from "./connection";
import { fillMetadata } from "./media";
import { buildTestDB, insertTestData, connection } from "./test-helpers";
import { Tables, DBAPI } from "./types";
import { OriginalInfo } from "./unsafe";

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

function createOriginal(
  connection: DatabaseConnection,
  media: DBAPI<Tables.Original>["media"],
  data: DBAPI<Omit<Tables.Original, "id" | "media">>,
): Promise<OriginalInfo> {
  return connection.withNewOriginal(
    media,
    data,
    (
      dbConnection: DatabaseConnection,
      original: OriginalInfo,
    ): Promise<OriginalInfo> =>
      Promise.resolve(original),
  );
}

test("Media tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");
  let user3Db = dbConnection.forUser("someone3@nowhere.com");

  await expect(user3Db.createMedia("c1", fillMetadata({})))
    .rejects.toThrow("Invalid user or catalog passed to createMedia");

  let createdMoment: Moment = realMoment.tz("2016-01-01T23:35:01", "UTC");
  mockedMoment.mockImplementationOnce((): Moment => createdMoment);

  let newMedia = await user3Db.createMedia("c3", fillMetadata({
    title: "My title",
  }));

  let id = newMedia.id;
  expect(newMedia).toEqual(fillMetadata({
    id: expect.stringMatching(/^M:[a-zA-Z0-9]+/),
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "My title",
  }));

  let foundMedia = await user3Db.getMedia(id);
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

  let info = await createOriginal(dbConnection, id, fillMetadata({
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

  foundMedia = await user3Db.getMedia(id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "My title", // Media set
    photographer: "Me", // OriginalInfo set

    uploaded: expect.toEqualDate(uploadedMoment),
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
  }));

  await user3Db.editMedia(id, {
    title: null,
    city: "Portland",
  });

  foundMedia = await user3Db.getMedia(id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "Info title", // OriginalInfo set
    photographer: "Me", // OriginalInfo set
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

  info = await createOriginal(dbConnection, id, fillMetadata({
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

  foundMedia = await user3Db.getMedia(id);
  expect(foundMedia).toEqual(fillMetadata({
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdMoment),

    title: "Different title", // OriginalInfo set
    model: "Some model", // OriginalInfo set
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

  await dbConnection.addAlternateFile(info.id, {
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

  await dbConnection.addAlternateFile(info.id, {
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

  await dbConnection.addAlternateFile(info.id, {
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

  let list = await user3Db.listAlternateFiles(id, AlternateFileType.Thumbnail);
  list.sort(
    (a: DBAPI<Tables.AlternateFile>, b: DBAPI<Tables.AlternateFile>): number => a.width - b.width,
  );
  expect(list).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: info.id,
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
    original: info.id,
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

  list = await user3Db.listAlternateFiles(id, AlternateFileType.Poster);
  list.sort(
    (a: DBAPI<Tables.AlternateFile>, b: DBAPI<Tables.AlternateFile>): number => a.width - b.width,
  );
  expect(list).toEqual([{
    id: expect.stringMatching(/^F:[a-zA-Z0-9]+/),
    original: info.id,
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
  await expect(user3Db.createMedia("c1", fillMetadata({
    title: "My title",
  }))).rejects.toThrow("Invalid user or catalog passed to createMedia");

  newMedia = await user1Db.createMedia("c1", fillMetadata({}));

  // Cannot add media info to a missing media.
  await expect(createOriginal(dbConnection, "biz", fillMetadata({
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
  foundMedia = await user3Db.getMedia(newMedia.id);
  expect(foundMedia).toBeNull();

  // Cannot list alternates for media the user cannot access.
  list = await user2Db.listAlternateFiles(id, AlternateFileType.Poster);
  expect(list).toHaveLength(0);
});
