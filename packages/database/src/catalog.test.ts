import { idSorted } from "pixelbin-utils";

import {
  listCatalogs,
  listTags,
  listAlbums,
  listPeople,
  createCatalog,
  createAlbum,
} from "./catalog";
import { connection } from "./connection";
import { insert, withChildren, from } from "./queries";
import { insertTestData, testData, buildTestDB } from "./test-helpers";
import { Table } from "./types";

buildTestDB({
  beforeAll,
  beforeEach,
  afterAll,
});

beforeEach((): Promise<void> => {
  return insertTestData();
});

test("Catalog table tests", async (): Promise<void> => {
  let catalogs = idSorted(await listCatalogs("someone1@nowhere.com"));
  expect(catalogs).toHaveLength(3);
  expect(catalogs).toEqual(testData[Table.Catalog]);

  catalogs = idSorted(await listCatalogs("someone2@nowhere.com"));
  expect(catalogs).toHaveLength(1);
  expect(catalogs).toEqual([testData[Table.Catalog][0]]);

  catalogs = idSorted(await listCatalogs("someone3@nowhere.com"));
  expect(catalogs).toHaveLength(2);
  expect(catalogs).toEqual([
    testData[Table.Catalog][1],
    testData[Table.Catalog][2],
  ]);

  // Should not allow duplicate IDs.
  await expect(insert(Table.Catalog, {
    id: "c1",
    name: "Bad ID Catalog",
  })).rejects.toThrow("duplicate key");

  // Can duplicate name.
  let catalog = await createCatalog("someone1@nowhere.com", {
    name: "Catalog 1",
  });
  expect(catalog).toEqual({
    id: expect.stringMatching(/[a-zA-Z0-9]+/),
    name: "Catalog 1",
  });

  catalog = await createCatalog("someone2@nowhere.com", {
    name: "New catalog",
  });
  expect(catalog).toEqual({
    id: expect.stringMatching(/[a-zA-Z0-9]+/),
    name: "New catalog",
  });

  catalogs = idSorted(await listCatalogs("someone2@nowhere.com"));
  expect(catalogs).toHaveLength(2);
  expect(catalogs).toEqual([
    catalog,
    testData[Table.Catalog][0],
  ]);

  await expect(createCatalog("someone5@nowhere.com", {
    name: "New catalog",
  })).rejects.toThrow("foreign key");
});

test("Tag table tests", async (): Promise<void> => {
  let knex = await connection;

  let tags = idSorted(await listTags("someone1@nowhere.com"));
  expect(tags).toHaveLength(8);
  expect(tags).toEqual(testData[Table.Tag]);

  tags = idSorted(await listTags("someone2@nowhere.com"));
  expect(tags).toHaveLength(5);
  expect(tags).toEqual([
    testData[Table.Tag][0],
    testData[Table.Tag][1],
    testData[Table.Tag][5],
    testData[Table.Tag][6],
    testData[Table.Tag][7],
  ]);

  tags = idSorted(await withChildren(Table.Tag, from(knex, Table.Tag).where("id", "t2")));
  expect(tags).toHaveLength(4);
  expect(tags).toEqual([
    testData[Table.Tag][1],
    testData[Table.Tag][5],
    testData[Table.Tag][6],
    testData[Table.Tag][7],
  ]);

  // Should not allow duplicate IDs.
  await expect(insert(Table.Tag, {
    id: "t1",
    catalog: "c1",
    parent: null,
    name: "Bad ID Tag",
  })).rejects.toThrow("duplicate key");

  // Should not allow duplicate name in the same parent.
  await expect(insert(Table.Tag, {
    id: "t9",
    catalog: "c1",
    parent: "t2",
    name: "tag6",
  })).rejects.toThrow("unique constraint");

  // Disregarding case.
  await expect(insert(Table.Tag, {
    id: "t9",
    catalog: "c1",
    parent: "t2",
    name: "tAg6",
  })).rejects.toThrow("unique constraint");

  // Should not allow adding to a different catalog to its parent.
  await expect(insert(Table.Tag, {
    id: "t9",
    catalog: "c2",
    parent: "t2",
    name: "tag9",
  })).rejects.toThrow("foreign key constraint");
});

test("Album table tests", async (): Promise<void> => {
  let knex = await connection;

  let albums = idSorted(await listAlbums("someone1@nowhere.com"));
  expect(albums).toHaveLength(8);
  expect(albums).toEqual(testData[Table.Album]);

  albums = idSorted(await listAlbums("someone2@nowhere.com"));
  expect(albums).toHaveLength(5);
  expect(albums).toEqual([
    testData[Table.Album][0],
    testData[Table.Album][1],
    testData[Table.Album][2],
    testData[Table.Album][3],
    testData[Table.Album][4],
  ]);

  albums = idSorted(await listAlbums("someone3@nowhere.com"));
  expect(albums).toHaveLength(3);
  expect(albums).toEqual([
    testData[Table.Album][5],
    testData[Table.Album][6],
    testData[Table.Album][7],
  ]);

  albums = idSorted(await withChildren(Table.Album, from(knex, Table.Album).where("id", "a1")));
  expect(albums).toHaveLength(4);
  expect(albums).toEqual([
    testData[Table.Album][0],
    testData[Table.Album][2],
    testData[Table.Album][3],
    testData[Table.Album][4],
  ]);

  // Should not allow duplicate IDs.
  await expect(insert(Table.Album, {
    id: "a1",
    catalog: "c1",
    parent: null,
    stub: null,
    name: "Bad ID Album",
  })).rejects.toThrow("duplicate key");

  // Should not allow duplicate name in the same parent.
  await expect(insert(Table.Album, {
    id: "a9",
    catalog: "c1",
    parent: "a1",
    stub: null,
    name: "Album 3",
  })).rejects.toThrow("unique constraint");

  // Disregarding case.
  await expect(insert(Table.Album, {
    id: "a9",
    catalog: "c1",
    parent: "a1",
    stub: null,
    name: "alBuM 3",
  })).rejects.toThrow("unique constraint");

  // Should not allow adding to a different catalog to its parent.
  await expect(insert(Table.Album, {
    id: "a9",
    catalog: "c2",
    parent: "a1",
    stub: null,
    name: "Album 9",
  })).rejects.toThrow("foreign key constraint");

  let album = await createAlbum("someone1@nowhere.com", "c1", {
    parent: null,
    stub: "foo",
    name: "New Album",
  });

  expect(album).toEqual({
    id: expect.stringMatching(/^A:[A-Za-z0-9]+/),
    catalog: "c1",
    parent: null,
    stub: "foo",
    name: "New Album",
  });

  // Shouldn't allow adding to a catalog that doesn't exist.
  await expect(createAlbum("someone1@nowhere.com", "c8", {
    parent: null,
    stub: "foo",
    name: "New Album",
  })).rejects.toThrow("Invalid user or catalog passed to createAlbum");

  // Or with a user that doesn't exist.
  await expect(createAlbum("foobar@nowhere.com", "c1", {
    parent: null,
    stub: "foo",
    name: "New Album",
  })).rejects.toThrow("Invalid user or catalog passed to createAlbum");

  // Or with a user that doesn't have access to the catalog
  await expect(createAlbum("someone3@nowhere.com", "c1", {
    parent: null,
    stub: "foo",
    name: "New Album",
  })).rejects.toThrow("Invalid user or catalog passed to createAlbum");
});

test("Person table tests", async (): Promise<void> => {
  let people = idSorted(await listPeople("someone1@nowhere.com"));
  expect(people).toHaveLength(6);
  expect(people).toEqual(testData[Table.Person]);

  people = idSorted(await listPeople("someone2@nowhere.com"));
  expect(people).toHaveLength(2);
  expect(people).toEqual([
    testData[Table.Person][0],
    testData[Table.Person][1],
  ]);

  people = idSorted(await listPeople("someone3@nowhere.com"));
  expect(people).toHaveLength(4);
  expect(people).toEqual([
    testData[Table.Person][2],
    testData[Table.Person][3],
    testData[Table.Person][4],
    testData[Table.Person][5],
  ]);

  // Should not allow duplicate IDs.
  await expect(insert(Table.Person, {
    id: "p1",
    catalog: "c3",
    name: "Bad ID Person",
  })).rejects.toThrow("duplicate key");

  // Should not allow duplicate name in the same catalog.
  await expect(insert(Table.Person, {
    id: "p7",
    catalog: "c1",
    name: "Person 1",
  })).rejects.toThrow("unique constraint");

  // Disregarding case.
  await expect(insert(Table.Person, {
    id: "p7",
    catalog: "c1",
    name: "peRsOn 1",
  })).rejects.toThrow("unique constraint");
});
