import { expect } from "../../test-helpers";
import { idSorted } from "../../utils";
import { connection, insertTestData, testData, buildTestDB } from "./test-helpers";
import { Table } from "./types";

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

test("Storage tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");
  let user3Db = dbConnection.forUser("someone3@nowhere.com");

  let allStorage = idSorted(await user1Db.listStorage());
  expect(allStorage).toHaveLength(0);

  allStorage = idSorted(await user2Db.listStorage());
  expect(allStorage).toHaveLength(1);
  expect(allStorage).toEqual([testData[Table.Storage][0]]);

  allStorage = idSorted(await user3Db.listStorage());
  expect(allStorage).toHaveLength(1);
  expect(allStorage).toEqual([testData[Table.Storage][1]]);

  let storage = await user1Db.createStorage({
    name: "My new storage",
    accessKeyId: "foobar",
    secretAccessKey: "baz",
    publicUrl: null,
    endpoint: null,
    path: null,
    bucket: "buckit",
    region: "somewhere-001",
  });

  expect(storage).toEqual({
    id: expect.stringMatching(/S:[a-zA-Z0-9]+/),
    user: "someone1@nowhere.com",
    name: "My new storage",
    accessKeyId: "foobar",
    secretAccessKey: "baz",
    publicUrl: null,
    endpoint: null,
    path: null,
    bucket: "buckit",
    region: "somewhere-001",
  });

  allStorage = idSorted(await user1Db.listStorage());
  expect(allStorage).toHaveLength(1);
  expect(allStorage).toEqual([storage]);
});

test("Catalog tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");
  let user3Db = dbConnection.forUser("someone3@nowhere.com");
  let user5Db = dbConnection.forUser("someone5@nowhere.com");

  let catalogs = idSorted(await user1Db.listCatalogs());
  expect(catalogs).toHaveLength(3);
  expect(catalogs).toEqual(testData[Table.Catalog]);

  catalogs = idSorted(await user2Db.listCatalogs());
  expect(catalogs).toHaveLength(1);
  expect(catalogs).toEqual([testData[Table.Catalog][0]]);

  catalogs = idSorted(await user3Db.listCatalogs());
  expect(catalogs).toHaveLength(2);
  expect(catalogs).toEqual([
    testData[Table.Catalog][1],
    testData[Table.Catalog][2],
  ]);

  // Can duplicate name.
  let catalog1 = await user2Db.createCatalog({
    storage: "s1",
    name: "Catalog 1",
  });
  expect(catalog1).toEqual({
    id: expect.stringMatching(/[a-zA-Z0-9]+/),
    storage: "s1",
    name: "Catalog 1",
  });

  let catalog2 = await user2Db.createCatalog({
    storage: "s1",
    name: "New catalog",
  });
  expect(catalog2).toEqual({
    id: expect.stringMatching(/[a-zA-Z0-9]+/),
    storage: "s1",
    name: "New catalog",
  });

  catalogs = idSorted(await user2Db.listCatalogs());
  expect(catalogs).toHaveLength(3);
  expect(catalogs).toInclude([
    catalog1,
    catalog2,
    testData[Table.Catalog][0],
  ]);

  await expect(user5Db.createCatalog({
    storage: "s1",
    name: "New catalog",
  })).rejects.toThrow("Unknown Storage.");

  await expect(user1Db.createCatalog({
    storage: "s5",
    name: "New catalog",
  })).rejects.toThrow("Unknown Storage.");

  await expect(user1Db.createCatalog({
    storage: "s1",
    name: "New catalog",
  })).rejects.toThrow("Unknown Storage.");
});

test("Tag table tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");
  let user3Db = dbConnection.forUser("someone3@nowhere.com");

  let fooUser = dbConnection.forUser("foobar@nowhere.com");

  let tags = idSorted(await user1Db.listTags());
  expect(tags).toHaveLength(8);
  expect(tags).toEqual(testData[Table.Tag]);

  tags = idSorted(await user2Db.listTags());
  expect(tags).toHaveLength(5);
  expect(tags).toEqual([
    testData[Table.Tag][0],
    testData[Table.Tag][1],
    testData[Table.Tag][5],
    testData[Table.Tag][6],
    testData[Table.Tag][7],
  ]);

  let tag = await user1Db.createTag("c1", {
    // @ts-ignore: Supplying an ID should not affect anything.
    id: "Bad",
    // @ts-ignore: Supplying a catalog should not affect anything.
    catalog: "c2",
    parent: null,
    name: "New Tag",
  });

  expect(tag.id).not.toBe("Bad");
  expect(tag).toEqual({
    id: expect.stringMatching(/^T:[A-Za-z0-9]+/),
    catalog: "c1",
    parent: null,
    name: "New Tag",
  });

  // Creating a tag that already exists should return the tag.
  tag = await user1Db.createTag("c1", {
    parent: null,
    name: "Tag1",
  });

  expect(tag).toEqual({
    id: "t1",
    catalog: "c1",
    parent: null,
    name: "Tag1",
  });

  // Shouldn't allow adding to a catalog that doesn't exist.
  await expect(user1Db.createTag("c8", {
    parent: null,
    name: "New Tag",
  })).rejects.toThrow("Unknown Catalog.");

  // Or with a user that doesn't exist.
  await expect(fooUser.createTag("c1", {
    parent: null,
    name: "New Tag",
  })).rejects.toThrow("Unknown Catalog.");

  // Or with a user that doesn't have access to the catalog
  await expect(user3Db.createTag("c1", {
    parent: null,
    name: "New Tag",
  })).rejects.toThrow("Unknown Catalog.");

  let updated = await user1Db.editTag("t7", {
    // @ts-ignore: Attempts to change id should be ignored.
    id: "newId",
    // @ts-ignore: Ditto for catalog.
    catalog: "c2",
    name: "New name",
    parent: "t1",
  });

  expect(updated).toEqual({
    id: "t7",
    catalog: "c1",
    parent: "t1",
    name: "New name",
  });

  // Attempting to alter a tag in a catalog the user cannot access should fail.
  await expect(user3Db.editTag("t1", {
    name: "Bad name",
  })).rejects.toThrow("Unknown Tag.");

  // Attempting to alter a tag that doesn't exist should fail.
  await expect(user3Db.editTag("t16", {
    name: "Bad name",
  })).rejects.toThrow("Unknown Tag.");

  // Changing to a bad parent should fail.
  await expect(user2Db.editTag(tag.id, {
    parent: "t3",
  })).rejects.toThrow("Unknown Tag when creating Tag.");

  let created = await user1Db.buildTags("c1", ["tag1", "New name", "new tag"]);
  expect(created).toEqual([{
    catalog: "c1",
    id: "t1",
    parent: null,
    name: "tag1",
  }, {
    catalog: "c1",
    id: "t7",
    parent: "t1",
    name: "New name",
  }, {
    catalog: "c1",
    id: expect.stringMatching(/^T:[A-Za-z0-9]+/),
    parent: "t7",
    name: "new tag",
  }]);

  created = await user1Db.buildTags("c1", ["New top", "inner", "new tag"]);
  expect(created).toEqual([{
    catalog: "c1",
    id: expect.stringMatching(/^T:[A-Za-z0-9]+/),
    parent: null,
    name: "New top",
  }, {
    catalog: "c1",
    id: expect.stringMatching(/^T:[A-Za-z0-9]+/),
    parent: created[0].id,
    name: "inner",
  }, {
    catalog: "c1",
    id: expect.stringMatching(/^T:[A-Za-z0-9]+/),
    parent: created[1].id,
    name: "new tag",
  }]);

  created = await user1Db.buildTags("c1", ["top-level"]);
  expect(created).toEqual([{
    catalog: "c1",
    id: expect.stringMatching(/^T:[A-Za-z0-9]+/),
    parent: null,
    name: "top-level",
  }]);

  tags = await user1Db.listTags();
  expect(tags).toHaveLength(14);

  await user1Db.deleteTags([
    "t3",
    "t5",
  ]);

  tags = await user1Db.listTags();
  expect(tags).toHaveLength(11);
});

test("Album table tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");
  let user3Db = dbConnection.forUser("someone3@nowhere.com");

  let fooUser = dbConnection.forUser("foobar@nowhere.com");

  let albums = idSorted(await user1Db.listAlbums());
  expect(albums).toHaveLength(8);
  expect(albums).toEqual(testData[Table.Album]);

  albums = idSorted(await user2Db.listAlbums());
  expect(albums).toHaveLength(5);
  expect(albums).toEqual([
    testData[Table.Album][0],
    testData[Table.Album][1],
    testData[Table.Album][2],
    testData[Table.Album][3],
    testData[Table.Album][4],
  ]);

  albums = idSorted(await user3Db.listAlbums());
  expect(albums).toHaveLength(3);
  expect(albums).toEqual([
    testData[Table.Album][5],
    testData[Table.Album][6],
    testData[Table.Album][7],
  ]);

  albums = idSorted(await user1Db.listAlbums());
  expect(albums).toHaveLength(8);
  expect(albums).toEqual([
    testData[Table.Album][0],
    testData[Table.Album][1],
    testData[Table.Album][2],
    testData[Table.Album][3],
    testData[Table.Album][4],
    testData[Table.Album][5],
    testData[Table.Album][6],
    testData[Table.Album][7],
  ]);

  await user1Db.deleteAlbums([
    "a1",
  ]);

  albums = idSorted(await user1Db.listAlbums());
  expect(albums).toHaveLength(4);
  expect(albums).toEqual([
    testData[Table.Album][1],
    testData[Table.Album][5],
    testData[Table.Album][6],
    testData[Table.Album][7],
  ]);

  let album = await user1Db.createAlbum("c1", {
    // @ts-ignore: Supplying an ID should not affect anything.
    id: "Bad",
    // @ts-ignore: Supplying a catalog should not affect anything.
    catalog: "c2",
    parent: null,
    name: "New Album",
  });

  expect(album.id).not.toBe("Bad");
  expect(album).toEqual({
    id: expect.stringMatching(/^A:[A-Za-z0-9]+/),
    catalog: "c1",
    parent: null,
    name: "New Album",
  });

  // Shouldn't allow adding to a catalog that doesn't exist.
  await expect(user1Db.createAlbum("c8", {
    parent: null,
    name: "New Album",
  })).rejects.toThrow("Unknown Catalog.");

  // Or with a user that doesn't exist.
  await expect(fooUser.createAlbum("c1", {
    parent: null,
    name: "New Album",
  })).rejects.toThrow("Unknown Catalog.");

  // Or with a user that doesn't have access to the catalog
  await expect(user3Db.createAlbum("c1", {
    parent: null,
    name: "New Album",
  })).rejects.toThrow("Unknown Catalog.");

  let updated = await user1Db.editAlbum(album.id, {
    // @ts-ignore: Attempts to change id should be ignored.
    id: "newId",
    // @ts-ignore: Ditto for catalog.
    catalog: "c2",
    name: "New name",
    parent: "a2",
  });

  expect(updated).toEqual({
    ...album,
    parent: "a2",
    name: "New name",
  });

  // Attempting to alter an album in a catalog the user cannot access should fail.
  await expect(user3Db.editAlbum("a2", {
    name: "Bad name",
  })).rejects.toThrow("Unknown Album.");

  // Attempting to alter an album that doesn't exist should fail.
  await expect(user3Db.editAlbum("a16", {
    name: "Bad name",
  })).rejects.toThrow("Unknown Album.");

  // Changing to a bad parent should fail.
  await expect(user2Db.editAlbum(album.id, {
    parent: "a6",
  })).rejects.toThrow("Unknown Album when creating Album.");
});

test("Person table tests", async (): Promise<void> => {
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let user2Db = dbConnection.forUser("someone2@nowhere.com");
  let user3Db = dbConnection.forUser("someone3@nowhere.com");

  let fooUser = dbConnection.forUser("foobar@nowhere.com");

  let people = idSorted(await user1Db.listPeople());
  expect(people).toHaveLength(6);
  expect(people).toEqual(testData[Table.Person]);

  people = idSorted(await user2Db.listPeople());
  expect(people).toHaveLength(2);
  expect(people).toEqual([
    testData[Table.Person][0],
    testData[Table.Person][1],
  ]);

  people = idSorted(await user3Db.listPeople());
  expect(people).toHaveLength(4);
  expect(people).toEqual([
    testData[Table.Person][2],
    testData[Table.Person][3],
    testData[Table.Person][4],
    testData[Table.Person][5],
  ]);

  people = idSorted(await user1Db.listPeople());
  expect(people).toHaveLength(6);
  expect(people).toEqual([
    testData[Table.Person][0],
    testData[Table.Person][1],
    testData[Table.Person][2],
    testData[Table.Person][3],
    testData[Table.Person][4],
    testData[Table.Person][5],
  ]);

  await user1Db.deletePeople([
    "p2",
    "p4",
  ]);

  people = idSorted(await user1Db.listPeople());
  expect(people).toHaveLength(4);
  expect(people).toEqual([
    testData[Table.Person][0],
    testData[Table.Person][2],
    testData[Table.Person][4],
    testData[Table.Person][5],
  ]);

  let person = await user1Db.createPerson("c1", {
    // @ts-ignore: Supplying an ID should not affect anything.
    id: "Bad",
    // @ts-ignore: Supplying a catalog should not affect anything.
    catalog: "c2",
    name: "New Person",
  });

  expect(person.id).not.toBe("Bad");
  expect(person).toEqual({
    id: expect.stringMatching(/^P:[A-Za-z0-9]+/),
    catalog: "c1",
    name: "New Person",
  });

  // Creating a person with the same name should just return the same person.
  person = await user1Db.createPerson("c1", {
    name: "person 1",
  });
  expect(person).toEqual({
    id: "p1",
    catalog: "c1",
    name: "person 1",
  });

  // Shouldn't allow adding to a catalog that doesn't exist.
  await expect(user1Db.createPerson("c8", {
    name: "New Person",
  })).rejects.toThrow("Unknown Catalog.");

  // Or with a user that doesn't exist.
  await expect(fooUser.createPerson("c1", {
    name: "New Person",
  })).rejects.toThrow("Unknown Catalog.");

  // Or with a user that doesn't have access to the catalog
  await expect(user3Db.createPerson("c1", {
    name: "New Tag",
  })).rejects.toThrow("Unknown Catalog.");

  let updated = await user1Db.editPerson(person.id, {
    // @ts-ignore: Attempts to change id should be ignored.
    id: "newId",
    // @ts-ignore: Ditto for catalog.
    catalog: "c2",
    name: "New name",
  });

  expect(updated).toEqual({
    ...person,
    name: "New name",
  });

  // Attempting to alter a person in a catalog the user cannot access should fail.
  await expect(user3Db.editPerson("p1", {
    name: "Bad name",
  })).rejects.toThrow("Unknown Person.");

  // Attempting to alter a person that doesn't exist should fail.
  await expect(user3Db.editPerson("p16", {
    name: "Bad name",
  })).rejects.toThrow("Unknown Person.");
});
