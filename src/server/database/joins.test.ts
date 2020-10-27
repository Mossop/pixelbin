import { emptyMetadata, RelationType } from "../../model";
import { expect, reordered, sortedIds } from "../../test-helpers";
import { buildTestDB, connection, insertTestData, testData } from "./test-helpers";
import { Table } from "./types";
import type { StoredMediaDetail } from "./types/tables";

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

function extracted(
  media: Pick<StoredMediaDetail, "id" | "catalog" | "tags" | "albums" | "people"> | null,
): unknown {
  if (!media) {
    return null;
  }

  return {
    id: media.id,
    catalog: media.catalog,
    tags: media.tags,
    albums: media.albums,
    people: media.people,
  };
}

test("Album media tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  let mediaInAlbum = async (album: string): Promise<string[]> => {
    let media = await user1Db.listMediaInAlbum(album);
    return media.map((item: StoredMediaDetail): string => item.id);
  };

  let media1 = await user1Db.createMedia("c1", emptyMetadata);
  let media2 = await user1Db.createMedia("c1", emptyMetadata);
  let media3 = await user1Db.createMedia("c1", emptyMetadata);
  let media4 = await user1Db.createMedia("c2", emptyMetadata);
  let media5 = await user1Db.createMedia("c2", emptyMetadata);
  let media6 = await user1Db.createMedia("c2", emptyMetadata);

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  await expect(user1Db.addMediaRelations(RelationType.Album, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ], [
    "a1",
  ])).rejects.toThrow("Items from multiple catalogs were passed.");

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  let added = await user1Db.addMediaRelations(RelationType.Album, [
    media1.id,
    media2.id,
    media3.id,
  ], [
    "a1",
  ]);

  media1.albums.push(testData[Table.Album][0]);
  media2.albums.push(testData[Table.Album][0]);
  media3.albums.push(testData[Table.Album][0]);

  expect(added).toEqual([
    media1,
    media2,
    media3,
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

  added = await user1Db.addMediaRelations(RelationType.Album, [
    media1.id,
    media2.id,
    media3.id,
  ], [
    "a1",
  ]);

  expect(added).toEqual([
    media1,
    media2,
    media3,
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

  await expect(user1Db.removeMediaRelations(RelationType.Album, [
    media1.id,
    "unknown",
    media4.id,
  ], [
    "a1",
    "a2",
  ])).rejects.toThrow("Unknown Media.");

  await expect(user1Db.removeMediaRelations(RelationType.Album, [
    media1.id,
    media4.id,
  ], [
    "a1",
    "a2",
  ])).rejects.toThrow("Items from multiple catalogs were passed.");

  await user1Db.removeMediaRelations(RelationType.Album, [
    media1.id,
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

  await user1Db.removeMediaRelations(RelationType.Album, [
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

  await expect(user2Db.addMediaRelations(RelationType.Album, [
    media1.id,
    media4.id,
    media5.id,
  ], [
    "a6",
  ])).rejects.toThrow("Unknown Media.");

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.addMediaRelations(RelationType.Album, [
    media4.id,
    media5.id,
  ], [
    "a6",
  ]);

  expect(sortedIds(added)).toEqual(sortedIds([
    media4,
    media5,
  ]));

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

  await expect(user2Db.removeMediaRelations(RelationType.Album, [
    media4.id,
    media5.id,
  ], [
    "a6",
  ])).rejects.toThrow("Unknown Media.");

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

  added = await user1Db.setRelationMedia(RelationType.Album, ["a6"], []);
  expect(added).toEqual([]);

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  await expect(user1Db.setMediaRelations(RelationType.Album, [
    media1.id,
    media3.id,
    media4.id,
    media5.id,
  ], [
    "a1",
    "a2",
    "a6",
    "a7",
  ])).rejects.toThrow("Items from multiple catalogs were passed.");

  expect(await mediaInAlbum("a1")).toEqual([]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([]);
  expect(await mediaInAlbum("a4")).toEqual([]);
  expect(await mediaInAlbum("a5")).toEqual([]);
  expect(await mediaInAlbum("a6")).toEqual([]);
  expect(await mediaInAlbum("a7")).toEqual([]);
  expect(await mediaInAlbum("a8")).toEqual([]);

  added = await user1Db.setMediaRelations(RelationType.Album, [
    media1.id,
    media3.id,
  ], [
    "a1",
    "a2",
  ]);

  expect(sortedIds(added)).toInclude(sortedIds([
    media1,
    media3,
  ]));

  added = await user1Db.setMediaRelations(RelationType.Album, [
    media4.id,
    media5.id,
  ], [
    "a6",
    "a7",
  ]);

  expect(sortedIds(added)).toInclude(sortedIds([
    media4,
    media5,
  ]));

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

  await expect(user1Db.removeMediaRelations(RelationType.Album, [
    media1.id,
    media4.id,
  ], [
    "a1",
    "a6",
  ])).rejects.toThrow("Items from multiple catalogs were passed.");

  await user1Db.removeMediaRelations(RelationType.Album, [
    media1.id,
  ], [
    "a1",
  ]);

  await user1Db.removeMediaRelations(RelationType.Album, [
    media4.id,
  ], [
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

  await expect(user1Db.addMediaRelations(RelationType.Album, [
    media2.id,
    media6.id,
  ], [
    "a2",
    "a3",
    "a7",
    "a8",
  ])).rejects.toThrow("Items from multiple catalogs were passed.");

  added = await user1Db.addMediaRelations(RelationType.Album, [
    media2.id,
  ], [
    "a2",
    "a3",
  ]);

  expect(sortedIds(added)).toEqual([
    media2.id,
  ]);

  added = await user1Db.addMediaRelations(RelationType.Album, [
    media6.id,
  ], [
    "a7",
  ]);

  expect(sortedIds(added)).toEqual([
    media6.id,
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

  await expect(user2Db.setMediaRelations(RelationType.Album, [
    media1.id,
    media5.id,
  ], [])).rejects.toThrow("Unknown Media.");

  added = await user2Db.setMediaRelations(RelationType.Album, [
    media1.id,
  ], []);

  expect(sortedIds(added)).toEqual([
    media1.id,
  ]);

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

  added = await user1Db.setRelationMedia(RelationType.Album, [
    "a2",
  ], []);

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

  await expect(user2Db.listMediaInAlbum("a7")).rejects.toThrow("Unknown Album.");

  let media = await user1Db.listMediaInAlbum("a1", true);
  expect(media.map(extracted)).toInclude([{
    id: media3.id,
    catalog: "c1",

    tags: [],
    people: [],
    albums: [{
      id: "a1",
      catalog: "c1",
      name: "Album 1",
      parent: null,
    }],
  }, {
    id: media2.id,
    catalog: "c1",

    tags: [],
    people: [],
    albums: [{
      id: "a3",
      catalog: "c1",
      name: "Album 3",
      parent: "a1",
    }],
  }]);

  media = await user1Db.listMediaInCatalog("c1");
  expect(media).toHaveLength(3);
  media = [
    media.find((media: StoredMediaDetail): boolean => media.id == media1.id)!,
    media.find((media: StoredMediaDetail): boolean => media.id == media2.id)!,
    media.find((media: StoredMediaDetail): boolean => media.id == media3.id)!,
  ];

  expect(media.map(extracted)).toInclude([{
    id: media1.id,
    catalog: "c1",

    tags: [],
    people: [],
    albums: [],
  }, {
    id: media2.id,
    catalog: "c1",

    tags: [],
    people: [],
    albums: [{
      id: "a3",
      catalog: "c1",
      name: "Album 3",
      parent: "a1",
    }],
  }, {
    id: media3.id,
    catalog: "c1",

    tags: [],
    people: [],
    albums: [{
      id: "a1",
      catalog: "c1",
      name: "Album 1",
      parent: null,
    }],
  }]);
});

test("Person location tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  let media1 = await user2Db.createMedia("c1", emptyMetadata);
  let media2 = await user2Db.createMedia("c1", emptyMetadata);
  let media3 = await user2Db.createMedia("c1", emptyMetadata);
  let media4 = await user1Db.createMedia("c3", emptyMetadata);

  await user2Db.addMediaRelations(RelationType.Person, [
    media1.id,
    media2.id,
  ], [
    "p1",
  ]);

  await user2Db.addMediaRelations(RelationType.Person, [
    media3.id,
  ], [
    "p2",
  ]);

  let media = await user1Db.getMedia([
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(media.map(extracted)).toEqual([{
    id: media1.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }],
  }, {
    id: media3.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media4.id,
    catalog: "c3",
    albums: [],
    tags: [],
    people: [],
  }]);

  await user2Db.setPersonLocations([{
    media: media1.id,
    person: "p2",
    location: {
      left: 0,
      right: 1,
      top: 0,
      bottom: 1,
    },
  }]);

  media = await user1Db.getMedia([
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(media.map(extracted)).toEqual([{
    id: media1.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }],
  }, {
    id: media3.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media4.id,
    catalog: "c3",
    albums: [],
    tags: [],
    people: [],
  }]);

  await user2Db.setPersonLocations([{
    media: media1.id,
    person: "p2",
    location: null,
  }, {
    media: media2.id,
    person: "p2",
    location: {
      left: 0,
      right: 1,
      top: 0,
      bottom: 1,
    },
  }]);

  media = await user1Db.getMedia([
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(media.map(extracted)).toEqual([{
    id: media1.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    id: media3.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media4.id,
    catalog: "c3",
    albums: [],
    tags: [],
    people: [],
  }]);

  await expect(() => user2Db.setPersonLocations([{
    media: media2.id,
    person: "p2",
    location: null,
  }, {
    media: "unknown",
    person: "p2",
    location: {
      left: 1,
      top: 1,
      bottom: 1,
      right: 5,
    },
  }])).rejects.toThrow();

  await expect(() => user2Db.setPersonLocations([{
    media: media2.id,
    person: "p2",
    location: null,
  }, {
    media: "unknown",
    person: "p2",
    location: null,
  }])).rejects.toThrow();

  await expect(() => user2Db.setPersonLocations([{
    media: media2.id,
    person: "p2",
    location: null,
  }, {
    media: media1.id,
    person: "unknown",
    location: null,
  }])).rejects.toThrow();

  await expect(() => user2Db.setPersonLocations([{
    media: media2.id,
    person: "p2",
    location: null,
  }, {
    media: media4.id,
    person: "p1",
    location: null,
  }])).rejects.toThrow();

  await expect(() => user2Db.setPersonLocations([{
    media: media2.id,
    person: "p2",
    location: null,
  }, {
    media: media1.id,
    person: "p4",
    location: null,
  }])).rejects.toThrow();

  await expect(() => user2Db.setPersonLocations([{
    media: media2.id,
    person: "p2",
    location: null,
  }, {
    media: media4.id,
    person: "p4",
    location: null,
  }])).rejects.toThrow();

  await expect(() => user1Db.setPersonLocations([{
    media: media2.id,
    person: "p2",
    location: null,
  }, {
    media: media1.id,
    person: "p4",
    location: null,
  }])).rejects.toThrow();

  await expect(() => user1Db.setPersonLocations([{
    media: media2.id,
    person: "p2",
    location: null,
  }, {
    media: media4.id,
    person: "p1",
    location: null,
  }])).rejects.toThrow();

  media = await user1Db.getMedia([
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(media.map(extracted)).toEqual([{
    id: media1.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    id: media3.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media4.id,
    catalog: "c3",
    albums: [],
    tags: [],
    people: [],
  }]);

  await user1Db.setPersonLocations([{
    media: media1.id,
    person: "p1",
    location: {
      left: 0,
      right: 1,
      top: 0,
      bottom: 1,
    },
  }, {
    media: media1.id,
    person: "p2",
    location: null,
  }]);

  media = await user1Db.getMedia([
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(reordered(media.map(extracted))).toEqual(reordered([{
    id: media1.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }, {
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    id: media3.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media4.id,
    catalog: "c3",
    albums: [],
    tags: [],
    people: [],
  }]));

  await user1Db.setPersonLocations([{
    media: media1.id,
    person: "p1",
    location: null,
  }, {
    media: media2.id,
    person: "p2",
    location: null,
  }]);

  media = await user1Db.getMedia([
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(media.map(extracted)).toEqual([{
    id: media1.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }, {
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media3.id,
    catalog: "c1",
    albums: [],
    tags: [],
    people: [{
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }, {
    id: media4.id,
    catalog: "c3",
    albums: [],
    tags: [],
    people: [],
  }]);
});
