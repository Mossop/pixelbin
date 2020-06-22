import { idSorted } from "pixelbin-utils";

import {
  listCatalogs,
  listTags,
  listAlbums,
  listPeople,
  createCatalog,
  createAlbum,
} from "./catalog";
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

test("Catalog tests", async (): Promise<void> => {
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
});

test("Album table tests", async (): Promise<void> => {
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
});
