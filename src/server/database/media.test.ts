import { AlternateFileType, emptyMetadata, RelationType } from "../../model";
import { expect, mockDateTime } from "../../test-helpers";
import { DateTime, now, parseDateTime } from "../../utils";
import { DatabaseConnection } from "./connection";
import { buildTestDB, insertTestData, connection } from "./test-helpers";
import { Table, Tables } from "./types";
import { OriginalInfo } from "./unsafe";

jest.mock("../../utils/datetime");

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

async function countRecords(connection: DatabaseConnection, table: Table): Promise<number> {
  let results = await connection.knex(table).select();
  return results.length;
}

function createOriginal(
  connection: DatabaseConnection,
  media: Tables.Original["media"],
  data: Omit<Tables.Original, "id" | "media">,
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

  await expect(user3Db.createMedia("c1", emptyMetadata))
    .rejects.toThrow("Failed to insert Media record");

  let createdDT = mockDateTime("2016-01-01T23:35:01Z");

  let newMedia = await user3Db.createMedia("c3", {
    ...emptyMetadata,
    title: "My title",
    taken: parseDateTime("2020-04-05T17:01:04-07:00"),
  });

  let id = newMedia.id;
  expect(newMedia).toEqual({
    ...emptyMetadata,
    id: expect.stringMatching(/^M:[a-zA-Z0-9]+/),
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(createdDT),

    title: "My title",
    taken: expect.toEqualDate("2020-04-05T17:01:04-07:00"),
    takenZone: "-07:00",

    albums: [],
    tags: [],
    people: [],
  });
  expect(newMedia.taken?.hour).toBe(17);

  let [foundMedia] = await user3Db.getMedia([id]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id,
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(createdDT),

    title: "My title", // Media set
    taken: expect.toEqualDate("2020-04-05T17:01:04-07:00"), // Media set
    takenZone: "-07:00",

    albums: [],
    tags: [],
    people: [],
  });
  expect(newMedia.taken?.hour).toBe(17);

  let uploadedDT: DateTime = parseDateTime("2020-01-03T15:31:01Z");

  let info = await createOriginal(dbConnection, id, {
    ...emptyMetadata,
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
    processVersion: 5,
    uploaded: uploadedDT,
    fileName: "biz.jpg",

    title: "Info title",
    photographer: "Me",
    taken: parseDateTime("2020-04-05T11:01:04-04:00"),
  });

  expect(info).toEqual({
    ...emptyMetadata,
    id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
    media: id,
    uploaded: expect.toEqualDate(uploadedDT),
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
    taken: expect.toEqualDate("2020-04-05T11:01:04-04:00"),
    takenZone: "-04:00",
  });
  expect(info.taken?.hour).toBe(11);

  [foundMedia] = await user3Db.getMedia([id]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(uploadedDT),

    title: "My title", // Media set
    photographer: "Me", // OriginalInfo set
    taken: expect.toEqualDate("2020-04-05T17:01:04-07:00"), // Media set
    takenZone: "-07:00",

    uploaded: expect.toEqualDate(uploadedDT),
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
    fileName: "biz.jpg",
    original: info.id,

    albums: [],
    tags: [],
    people: [],
  });
  expect(foundMedia?.taken?.hour).toBe(17);

  let editedDT = mockDateTime("2020-02-03T15:31:01Z");

  await user3Db.editMedia(id, {
    title: null,
    city: "Portland",
    taken: null,
  });

  [foundMedia] = await user3Db.getMedia([id]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(editedDT),

    title: "Info title", // OriginalInfo set
    photographer: "Me", // OriginalInfo set
    city: "Portland", // Media set
    taken: expect.toEqualDate("2020-04-05T11:01:04-04:00"), // OriginalInfo set
    takenZone: "-04:00",

    uploaded: expect.toEqualDate(uploadedDT),
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
    fileName: "biz.jpg",
    original: info.id,

    albums: [],
    tags: [],
    people: [],
  });
  expect(foundMedia?.taken?.hour).toBe(11);

  let uploaded2DT = mockDateTime("2020-02-04T15:31:01Z");

  info = await createOriginal(dbConnection, id, {
    ...emptyMetadata,
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 2000,
    processVersion: 5,
    uploaded: uploaded2DT,
    fileName: "bar.jpg",

    title: "Different title",
    model: "Some model",
  });

  expect(info).toEqual({
    ...emptyMetadata,
    id: expect.stringMatching(/^I:[a-zA-Z0-9]+/),
    media: id,
    uploaded: expect.toEqualDate(uploaded2DT),
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
  });

  [foundMedia] = await user3Db.getMedia([id]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(uploaded2DT),

    title: "Different title", // OriginalInfo set
    model: "Some model", // OriginalInfo set
    city: "Portland", // Media set

    uploaded: expect.toEqualDate(uploaded2DT),
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 2000,
    fileName: "bar.jpg",
    original: info.id,

    albums: [],
    tags: [],
    people: [],
  });

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
    (a: Tables.AlternateFile, b: Tables.AlternateFile): number => a.width - b.width,
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
    (a: Tables.AlternateFile, b: Tables.AlternateFile): number => a.width - b.width,
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
  await expect(user3Db.createMedia("c1", {
    ...emptyMetadata,
    title: "My title",
  })).rejects.toThrow("Failed to insert Media record");

  newMedia = await user1Db.createMedia("c1", { ...emptyMetadata });

  // Cannot add media info to a missing media.
  await expect(createOriginal(dbConnection, "biz", {
    ...emptyMetadata,
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
    processVersion: 5,
    uploaded: now(),
    fileName: "foo.jpg",
  })).rejects.toThrow("Unknown Media");

  // Cannot get media in a catalog the user cannot access.
  let found = await user3Db.getMedia([newMedia.id]);
  expect(found).toEqual([
    null,
  ]);

  found = await user3Db.getMedia([
    id,
    newMedia.id,
    id,
    newMedia.id,
    id,
  ]);
  expect(found).toEqual([
    expect.objectContaining({
      id,
    }),
    null,
    expect.objectContaining({
      id,
    }),
    null,
    expect.objectContaining({
      id,
    }),
  ]);

  // Cannot list alternates for media the user cannot access.
  list = await user2Db.listAlternateFiles(id, AlternateFileType.Poster);
  expect(list).toHaveLength(0);

  // Unknown properties should be ignored.
  newMedia = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    // @ts-ignore: Intentionally incorrect.
    bob: "baz",
  });

  expect(newMedia["bob"]).toBeUndefined();

  await user3Db.addMediaRelations(RelationType.Album, [id], ["a8"]);
  await user3Db.addMediaRelations(RelationType.Tag, [id], ["t4"]);
  await user3Db.addMediaRelations(RelationType.Person, [id], ["p4"]);

  let [updated] = await user3Db.getMedia([id]);
  expect(updated).toEqual({
    ...emptyMetadata,
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(uploaded2DT),

    title: "Different title", // OriginalInfo set
    model: "Some model", // OriginalInfo set
    city: "Portland", // Media set

    uploaded: expect.toEqualDate(uploaded2DT),
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 2000,
    fileName: "bar.jpg",
    original: info.id,

    albums: [{
      id: "a8",
      catalog: "c3",
      parent: null,
      name: "Album 8",
    }],
    tags: [{
      id: "t4",
      catalog: "c3",
      name: "tag4",
      parent: "t3",
    }],
    people: [{
      id: "p4",
      name: "Person 4",
      location: null,
      catalog: "c3",
    }],
  });

  expect(await countRecords(dbConnection, Table.Media)).toBe(3);

  await user3Db.deleteMedia([id, newMedia.id]);

  let remaining = await user1Db.getMedia([id, newMedia.id]);
  expect(remaining).toEqual([
    null,
    newMedia,
  ]);

  expect(await countRecords(dbConnection, Table.Media)).toBe(2);
  expect(await countRecords(dbConnection, Table.MediaAlbum)).toBe(0);
  expect(await countRecords(dbConnection, Table.MediaPerson)).toBe(0);
  expect(await countRecords(dbConnection, Table.MediaTag)).toBe(0);
  expect(await countRecords(dbConnection, Table.Original)).toBe(0);
  expect(await countRecords(dbConnection, Table.AlternateFile)).toBe(0);
});
