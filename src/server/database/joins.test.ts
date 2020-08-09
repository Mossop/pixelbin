import { expect } from "../../test-helpers";
import { fillMetadata } from "./media";
import { from } from "./queries";
import { buildTestDB, connection, insertTestData } from "./test-helpers";
import { Table } from "./types";
import { MediaAlbum } from "./types/joins";

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

test("Album media tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  let mediaInAlbum = async (album: string): Promise<string[]> => {
    let media = await from(dbConnection.knex, Table.MediaAlbum).where("album", album).select("*");
    return media.map((item: MediaAlbum): string => item.media);
  };

  let media1 = await user1Db.createMedia("c1", fillMetadata({}));
  let media2 = await user1Db.createMedia("c1", fillMetadata({}));
  let media3 = await user1Db.createMedia("c1", fillMetadata({}));
  let media4 = await user1Db.createMedia("c2", fillMetadata({}));
  let media5 = await user1Db.createMedia("c2", fillMetadata({}));
  let media6 = await user1Db.createMedia("c2", fillMetadata({}));

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  let added = await user1Db.addMedia(Table.MediaAlbum, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ], [
    "a1",
  ]);

  expect(added).toInclude([
    { media: media1.id, album: "a1" },
    { media: media2.id, album: "a1" },
    { media: media3.id, album: "a1" },
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media1.id,
    media2.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.addMedia(Table.MediaAlbum, [
    media1.id,
    media2.id,
    media3.id,
  ], [
    "a1",
  ]);

  expect(added).toInclude([
    { media: media1.id, album: "a1" },
    { media: media2.id, album: "a1" },
    { media: media3.id, album: "a1" },
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media1.id,
    media2.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  await user1Db.removeMedia(Table.MediaAlbum, [
    media1.id,
    "unknown",
    media4.id,
  ], [
    "a1",
    "a2",
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media2.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  await user1Db.removeMedia(Table.MediaAlbum, [
    media2.id,
    media3.id,
  ], [
    "a1",
  ]);

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user2Db.addMedia(Table.MediaAlbum, [
    media1.id,
    media4.id,
    media5.id,
  ], [
    "a6",
  ]);

  expect(added).toEqual([]);

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.addMedia(Table.MediaAlbum, [
    media4.id,
    media5.id,
  ], [
    "a6",
  ]);

  expect(added).toInclude([
    { media: media4.id, album: "a6" },
    { media: media5.id, album: "a6" },
  ]);

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toInclude([
    media4.id,
    media5.id,
  ]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  await user2Db.removeMedia(Table.MediaAlbum, [
    media4.id,
    media5.id,
  ], [
    "a6",
  ]);

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toInclude([
    media4.id,
    media5.id,
  ]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.setMedia(Table.MediaAlbum, [], ["a6"]);
  expect(added).toEqual([]);

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.setMedia(Table.MediaAlbum, [
    media1.id,
    media3.id,
    media4.id,
    media5.id,
  ], [
    "a1",
    "a2",
    "a6",
    "a7",
  ]);

  expect(added).toInclude([
    { media: media1.id, album: "a1" },
    { media: media3.id, album: "a1" },
    { media: media1.id, album: "a2" },
    { media: media3.id, album: "a2" },
    { media: media4.id, album: "a6" },
    { media: media5.id, album: "a6" },
    { media: media4.id, album: "a7" },
    { media: media5.id, album: "a7" },
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media1.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toInclude([
    media1.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toInclude([
    media4.id,
    media5.id,
  ]);
  expect(await mediaInAlbum("a7")).toInclude([
    media4.id,
    media5.id,
  ]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  await user1Db.removeMedia(Table.MediaAlbum, [
    media1.id,
    media4.id,
  ], [
    "a1",
    "a6",
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toInclude([
    media1.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toInclude([
    media5.id,
  ]);
  expect(await mediaInAlbum("a7")).toInclude([
    media4.id,
    media5.id,
  ]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.addMedia(Table.MediaAlbum, [
    media2.id,
    media6.id,
  ], [
    "a2",
    "a3",
    "a7",
    "a8",
  ]);

  expect(added).toInclude([
    { media: media2.id, album: "a2" },
    { media: media2.id, album: "a3" },
    { media: media6.id, album: "a7" },
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toInclude([
    media1.id,
    media2.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a3")).toInclude([
    media2.id,
  ]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toInclude([
    media5.id,
  ]);
  expect(await mediaInAlbum("a7")).toInclude([
    media4.id,
    media5.id,
    media6.id,
  ]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user2Db.setMedia(Table.MediaAlbum, [
    media1.id,
    media5.id,
  ], []);

  expect(added).toEqual([]);

  expect(await mediaInAlbum("a1")).toInclude([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toInclude([
    media2.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a3")).toInclude([
    media2.id,
  ]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([
    media5.id,
  ]);
  expect(await mediaInAlbum("a7")).toInclude([
    media4.id,
    media5.id,
    media6.id,
  ]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.setMedia(Table.MediaAlbum, [], [
    "a2",
  ]);

  expect(added).toEqual([]);

  expect(await mediaInAlbum("a1")).toInclude([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toInclude([
    media2.id,
  ]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([
    media5.id,
  ]);
  expect(await mediaInAlbum("a7")).toInclude([
    media4.id,
    media5.id,
    media6.id,
  ]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.setMedia(Table.MediaAlbum, [], []);

  expect(added).toEqual([]);

  expect(await mediaInAlbum("a1")).toInclude([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toInclude([
    media2.id,
  ]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([
    media5.id,
  ]);
  expect(await mediaInAlbum("a7")).toInclude([
    media4.id,
    media5.id,
    media6.id,
  ]);
  expect(await mediaInAlbum("a8")).toEqual([]);
});
