import { emptyMetadata, RelationType } from "../../model";
import { expect, sortedIds } from "../../test-helpers";
import { parseDateTime } from "../../utils";
import type { UserScopedConnection } from "./connection";
import type { LinkedAlbum, LinkedPerson, LinkedTag } from "./joins";
import type { MediaView } from "./mediaview";
import { buildTestDB, connection, insertTestData } from "./test-helpers";

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

function sorted(items: string[]): string[] {
  let result = [...items];
  result.sort();
  return result;
}

function tagList(tags: LinkedTag[]): string[] {
  return sorted(tags.map((tag: LinkedTag): string => tag.tag.id));
}

function albumList(albums: LinkedAlbum[]): string[] {
  return albums.map((album: LinkedAlbum): string => album.album.id);
}

function personList(people: LinkedPerson[]): unknown[] {
  return people.map((person: LinkedPerson): unknown => ({
    person: person.person.id,
    location: person.location,
  }));
}

async function mediaRelations(db: UserScopedConnection, media: string[]): Promise<unknown> {
  return Promise.all(media.map(async (item: string): Promise<unknown> => {
    return {
      tags: tagList(await db.getMediaTags(item)),
      albums: albumList(await db.getMediaAlbums(item)),
      people: personList(await db.getMediaPeople(item)),
    };
  }));
}

test("Album media tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  let mediaInAlbum = async (album: string): Promise<string[]> => {
    let media = await user1Db.listMediaInAlbum(album);
    return media.map((item: MediaView): string => item.id);
  };

  let media1 = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    taken: parseDateTime("2019-01-01T04:05:06Z"),
  });
  let media2 = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    taken: parseDateTime("2020-01-01T04:05:06Z"),
  });
  let media3 = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    taken: parseDateTime("2018-01-01T04:05:06Z"),
  });
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

  expect(added).toEqual([
    media1,
    media2,
    media3,
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media2.id,
    media1.id,
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
    media2.id,
    media1.id,
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

  expect(await mediaInAlbum("a1")).toEqual([
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

  expect(await mediaInAlbum("a1")).toEqual([
    media1.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([
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

  expect(await mediaInAlbum("a1")).toEqual([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([
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

  expect(await mediaInAlbum("a1")).toEqual([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toInclude([
    media2.id,
    media1.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a3")).toEqual([
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

  expect(await mediaInAlbum("a1")).toEqual([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toInclude([
    media2.id,
    media3.id,
  ]);
  expect(await mediaInAlbum("a3")).toEqual([
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

  expect(await mediaInAlbum("a1")).toEqual([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([
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

  expect(await mediaInAlbum("a1")).toEqual([
    media3.id,
  ]);
  expect(await mediaInAlbum("a2")).toEqual([]);
  expect(await mediaInAlbum("a3")).toEqual([
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
  expect(media).toInclude([
    media2,
    media3,
  ]);

  media = await user1Db.listMediaInCatalog("c1");
  expect(media).toHaveLength(3);

  expect(media).toInclude([
    media2,
    media1,
    media3,
  ]);

  let relations = await mediaRelations(user1Db, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
    media5.id,
    media6.id,
  ]);
  expect(relations).toEqual([{
    tags: [],
    people: [],
    albums: [],
  }, {
    tags: [],
    people: [],
    albums: ["a3"],
  }, {
    tags: [],
    people: [],
    albums: ["a1"],
  }, {
    tags: [],
    people: [],
    albums: ["a7"],
  }, {
    tags: [],
    people: [],
    albums: ["a6", "a7"],
  }, {
    tags: [],
    people: [],
    albums: ["a7"],
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

  let relations = await mediaRelations(user1Db, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(relations).toEqual([{
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p2",
      location: null,
    }],
  }, {
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

  relations = await mediaRelations(user1Db, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(relations).toEqual([{
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p2",
      location: null,
    }],
  }, {
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

  relations = await mediaRelations(user1Db, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(relations).toEqual([{
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p2",
      location: null,
    }],
  }, {
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

  relations = await mediaRelations(user1Db, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(relations).toEqual([{
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p2",
      location: null,
    }],
  }, {
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

  relations = await mediaRelations(user1Db, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(relations).toEqual([{
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }, {
      person: "p2",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p2",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [],
  }]);

  await user1Db.setPersonLocations([{
    media: media1.id,
    person: "p1",
    location: null,
  }, {
    media: media2.id,
    person: "p2",
    location: null,
  }]);

  relations = await mediaRelations(user1Db, [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(relations).toEqual([{
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [{
      person: "p2",
      location: null,
    }],
  }, {
    albums: [],
    tags: [],
    people: [],
  }]);
});
