import { AlternateFileType, emptyMetadata, RelationType } from "../../model";
import { expect, mockDateTime } from "../../test-helpers";
import type { DateTime } from "../../utils";
import { now, parseDateTime } from "../../utils";
import type { DatabaseConnection } from "./connection";
import { buildTestDB, insertTestData, connection } from "./test-helpers";
import type { Tables } from "./types";
import { Table } from "./types";

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

async function countRecords(connection: DatabaseConnection, table: Table): Promise<number> {
  let results = await connection.knex(table).select();
  return results.length;
}

function createMediaFile(
  connection: DatabaseConnection,
  media: Tables.MediaView["id"],
  data: Omit<Tables.MediaFile, "id" | "media">,
): Promise<Tables.MediaFile> {
  return connection.withNewMediaFile(
    media,
    data,
    async (
      dbConnection: DatabaseConnection,
      mediaFile: Tables.MediaFile,
    ): Promise<Tables.MediaFile> => mediaFile,
  );
}

test("Media tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");
  let user3Db = dbConnection.forUser("someone3@nowhere.com");

  await expect(user3Db.createMedia("c1", emptyMetadata))
    .rejects.toThrow("Unknown Catalog.");

  let taken = parseDateTime("2020-04-05T17:01:04-07:00");
  let createdDT = mockDateTime("2016-01-01T23:35:01Z");

  let newMedia = await user3Db.createMedia("c3", {
    ...emptyMetadata,
    title: "My title",
    taken,
  });

  let id = newMedia.id;
  expect(newMedia).toEqual({
    ...emptyMetadata,
    id: expect.toBeId("M"),
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(createdDT),
    file: null,

    title: "My title",
    taken: expect.toEqualDate("2020-04-05T17:01:04-07:00"),
    takenZone: "UTC-7",

    albums: [],
    tags: [],
    people: [],
  });

  let [foundMedia] = await user3Db.getMedia([id]);
  expect(foundMedia).toEqual({
    ...emptyMetadata,
    id,
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(createdDT),
    file: null,

    title: "My title", // Media set
    taken: expect.toEqualDate("2020-04-05T17:01:04-07:00"), // Media set
    takenZone: "UTC-7",

    albums: [],
    tags: [],
    people: [],
  });

  let user = await dbConnection.getUserForMedia(id);
  expect(user).toEqual({
    email: "someone3@nowhere.com",
    fullname: "Someone 3",
    administrator: false,
    created: expect.toEqualDate("2015-01-01T00:00:00Z"),
    lastLogin: expect.toEqualDate("2020-03-03T00:00:00Z"),
    verified: true,
  });

  let uploadedDT: DateTime = parseDateTime("2020-01-03T15:31:01Z");

  let info = await createMediaFile(dbConnection, id, {
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
    id: expect.toBeId("I"),
    processVersion: 5,
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
    takenZone: "UTC-4",
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
    takenZone: "UTC-7",

    file: {
      id: info.id,
      processVersion: 5,
      uploaded: expect.toEqualDate(uploadedDT),
      mimetype: "image/jpeg",
      width: 1024,
      height: 768,
      duration: null,
      bitRate: null,
      frameRate: null,
      fileSize: 1000,
      fileName: "biz.jpg",
      thumbnails: [],
      alternatives: [],
    },

    albums: [],
    tags: [],
    people: [],
  });

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
    takenZone: "UTC-4",

    file: {
      id: info.id,
      processVersion: 5,
      uploaded: expect.toEqualDate(uploadedDT),
      mimetype: "image/jpeg",
      width: 1024,
      height: 768,
      duration: null,
      bitRate: null,
      frameRate: null,
      fileSize: 1000,
      fileName: "biz.jpg",
      thumbnails: [],
      alternatives: [],
    },

    albums: [],
    tags: [],
    people: [],
  });

  editedDT = mockDateTime("2020-09-02T05:06:23Z");

  await user3Db.editMedia(id, {
    taken: parseDateTime("2019-03-05T08:23:12"),
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
    taken: expect.toEqualDate("2019-03-05T08:23:12-07:00"), // Media set
    takenZone: "UTC-7",

    file: {
      id: info.id,
      processVersion: 5,
      uploaded: expect.toEqualDate(uploadedDT),
      mimetype: "image/jpeg",
      width: 1024,
      height: 768,
      duration: null,
      bitRate: null,
      frameRate: null,
      fileSize: 1000,
      fileName: "biz.jpg",
      thumbnails: [],
      alternatives: [],
    },

    albums: [],
    tags: [],
    people: [],
  });

  editedDT = mockDateTime("2020-08-02T05:06:23Z");

  await user3Db.editMedia(id, {
    takenZone: null,
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
    taken: expect.toEqualDate("2019-03-05T08:23:12"), // Media set
    takenZone: null,

    file: {
      id: info.id,
      processVersion: 5,
      uploaded: expect.toEqualDate(uploadedDT),
      mimetype: "image/jpeg",
      width: 1024,
      height: 768,
      duration: null,
      bitRate: null,
      frameRate: null,
      fileSize: 1000,
      fileName: "biz.jpg",
      thumbnails: [],
      alternatives: [],
    },

    albums: [],
    tags: [],
    people: [],
  });

  let uploaded2DT = mockDateTime("2020-09-04T15:31:01Z");

  info = await createMediaFile(dbConnection, id, {
    ...emptyMetadata,
    mimetype: "image/jpeg",
    width: 2048,
    height: 1024,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 2000,
    processVersion: 7,
    uploaded: uploaded2DT,
    fileName: "bar.jpg",

    title: "Different title",
    model: "Some model",
  });

  expect(info).toEqual({
    ...emptyMetadata,
    id: expect.toBeId("I"),
    processVersion: 7,
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
    taken: expect.toEqualDate("2019-03-05T08:23:12"), // Media set
    takenZone: null,

    file: {
      id: info.id,
      processVersion: 7,
      uploaded: expect.toEqualDate(uploaded2DT),
      mimetype: "image/jpeg",
      width: 2048,
      height: 1024,
      duration: null,
      bitRate: null,
      frameRate: null,
      fileSize: 2000,
      fileName: "bar.jpg",
      thumbnails: [],
      alternatives: [],
    },

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
    type: AlternateFileType.Reencode,
    fileName: "alternate.jpg",
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
    id: expect.toBeId("F"),
    mediaFile: info.id,
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
    id: expect.toBeId("F"),
    mediaFile: info.id,
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
  let jpgId = list[0].id;
  let webpId = list[1].id;

  list = await user3Db.listAlternateFiles(id, AlternateFileType.Reencode);
  list.sort(
    (a: Tables.AlternateFile, b: Tables.AlternateFile): number => a.width - b.width,
  );
  expect(list).toEqual([{
    id: expect.toBeId("F"),
    mediaFile: info.id,
    type: AlternateFileType.Reencode,
    fileName: "alternate.jpg",
    fileSize: 300,
    mimetype: "image/jpeg",
    width: 200,
    height: 100,
    duration: null,
    frameRate: null,
    bitRate: null,
  }]);
  let alternateId = list[0].id;

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
    taken: expect.toEqualDate("2019-03-05T08:23:12"), // Media set
    takenZone: null,

    file: {
      id: info.id,
      processVersion: 7,
      uploaded: expect.toEqualDate(uploaded2DT),
      mimetype: "image/jpeg",
      width: 2048,
      height: 1024,
      duration: null,
      bitRate: null,
      frameRate: null,
      fileSize: 2000,
      fileName: "bar.jpg",
      thumbnails: expect.anything(),
      alternatives: [{
        id: alternateId,
        fileName: "alternate.jpg",
        fileSize: 300,
        mimetype: "image/jpeg",
        width: 200,
        height: 100,
        duration: null,
        frameRate: null,
        bitRate: null,
      }],
    },

    albums: [],
    tags: [],
    people: [],
  });

  expect(foundMedia?.file?.thumbnails).toInclude([{
    id: jpgId,
    fileName: "thumb.jpg",
    fileSize: 400,
    mimetype: "image/jpeg",
    width: 500,
    height: 300,
    duration: null,
    frameRate: null,
    bitRate: null,
  }, {
    id: webpId,
    fileName: "thumb.webp",
    fileSize: 200,
    mimetype: "image/webp",
    width: 600,
    height: 300,
    duration: null,
    frameRate: null,
    bitRate: null,
  }]);

  // Cannot create media in a catalog the user cannot access.
  await expect(user3Db.createMedia("c1", {
    ...emptyMetadata,
    title: "My title",
  })).rejects.toThrow("Unknown Catalog.");

  newMedia = await user1Db.createMedia("c1", { ...emptyMetadata });

  // Cannot add media info to a missing media.
  await expect(createMediaFile(dbConnection, "biz", {
    ...emptyMetadata,
    mimetype: "image/jpeg",
    width: 1024,
    height: 768,
    duration: null,
    bitRate: null,
    frameRate: null,
    fileSize: 1000,
    processVersion: 2,
    uploaded: now(),
    fileName: "foo.jpg",
  })).rejects.toThrow("Unknown Media.");

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
  await expect(
    user2Db.listAlternateFiles(id, AlternateFileType.Reencode),
  ).rejects.toThrow("Unknown Media.");

  // Unknown properties should throw an error.
  await expect(user1Db.createMedia("c1", {
    ...emptyMetadata,
    // @ts-ignore
    bob: "baz",
  })).rejects.toThrow("bob");

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
    taken: expect.toEqualDate("2019-03-05T08:23:12"), // Media set
    takenZone: null,

    file: {
      id: info.id,
      processVersion: 7,
      uploaded: expect.toEqualDate(uploaded2DT),
      mimetype: "image/jpeg",
      width: 2048,
      height: 1024,
      duration: null,
      bitRate: null,
      frameRate: null,
      fileSize: 2000,
      fileName: "bar.jpg",
      thumbnails: expect.anything(),
      alternatives: [{
        id: alternateId,
        fileName: "alternate.jpg",
        fileSize: 300,
        mimetype: "image/jpeg",
        width: 200,
        height: 100,
        duration: null,
        frameRate: null,
        bitRate: null,
      }],
    },

    albums: [{
      album: "a8",
    }],
    tags: [{
      tag: "t4",
    }],
    people: [{
      person: "p4",
      location: null,
    }],
  });

  await user3Db.deleteTags(["t3"]);
  await user3Db.deleteAlbums(["a8"]);
  await user3Db.deletePeople(["p4"]);

  [updated] = await user3Db.getMedia([id]);
  expect(updated).toEqual({
    ...emptyMetadata,
    id: id,
    catalog: "c3",
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(uploaded2DT),

    title: "Different title", // OriginalInfo set
    model: "Some model", // OriginalInfo set
    city: "Portland", // Media set
    taken: expect.toEqualDate("2019-03-05T08:23:12"), // Media set
    takenZone: null,

    file: {
      id: info.id,
      processVersion: 7,
      uploaded: expect.toEqualDate(uploaded2DT),
      mimetype: "image/jpeg",
      width: 2048,
      height: 1024,
      duration: null,
      bitRate: null,
      frameRate: null,
      fileSize: 2000,
      fileName: "bar.jpg",
      thumbnails: expect.anything(),
      alternatives: [{
        id: alternateId,
        fileName: "alternate.jpg",
        fileSize: 300,
        mimetype: "image/jpeg",
        width: 200,
        height: 100,
        duration: null,
        frameRate: null,
        bitRate: null,
      }],
    },

    albums: [],
    tags: [],
    people: [],
  });

  expect(await countRecords(dbConnection, Table.MediaInfo)).toBe(2);
  expect(await countRecords(dbConnection, Table.MediaView)).toBe(2);
  expect(await countRecords(dbConnection, Table.MediaAlbum)).toBe(0);
  expect(await countRecords(dbConnection, Table.MediaPerson)).toBe(0);
  expect(await countRecords(dbConnection, Table.MediaTag)).toBe(0);
  expect(await countRecords(dbConnection, Table.MediaFile)).toBe(2);
  expect(await countRecords(dbConnection, Table.AlternateFile)).toBe(3);

  // Deleting doesn't actually remove from the database.
  await expect(user3Db.deleteMedia([id, newMedia.id])).rejects.toThrow("Unknown Media.");
  await user3Db.deleteMedia([id]);

  let remaining = await user1Db.getMedia([id, newMedia.id]);
  expect(remaining).toEqual([
    null,
    newMedia,
  ]);

  expect(await countRecords(dbConnection, Table.MediaView)).toBe(1);
  expect(await countRecords(dbConnection, Table.MediaInfo)).toBe(2);
  expect(await countRecords(dbConnection, Table.MediaAlbum)).toBe(0);
  expect(await countRecords(dbConnection, Table.MediaPerson)).toBe(0);
  expect(await countRecords(dbConnection, Table.MediaTag)).toBe(0);
  expect(await countRecords(dbConnection, Table.MediaFile)).toBe(2);
  expect(await countRecords(dbConnection, Table.AlternateFile)).toBe(3);

  await expect(user1Db.listMediaInAlbum("a8", true)).rejects.toThrow("Unknown Album.");
  await expect(
    user1Db.listAlternateFiles(id, AlternateFileType.Reencode),
  ).rejects.toThrow("Unknown Media.");
  await expect(
    user1Db.listAlternateFiles(id, AlternateFileType.Thumbnail),
  ).rejects.toThrow("Unknown Media.");
});

test("getMedia", async (): Promise<void> => {
  let dbConnection = await connection;
  let user3Db = dbConnection.forUser("someone3@nowhere.com");

  let newMedia: Tables.MediaView[] = [];
  for (let i = 0; i < 100; i++) {
    newMedia.push(await user3Db.createMedia("c3", emptyMetadata));
  }

  let ids = newMedia.map((media: Tables.MediaView): string => media.id);
  let results = (await user3Db.getMedia(ids))
    .map((media: Tables.MediaView | null): string | undefined => media?.id);
  expect(results).toEqual(ids);

  ids.sort();
  results = (await user3Db.getMedia(ids))
    .map((media: Tables.MediaView | null): string | undefined => media?.id);
  expect(results).toEqual(ids);
});
