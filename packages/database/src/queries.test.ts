import { idSorted } from "pixelbin-utils";

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
  // Should not allow duplicate IDs.
  await expect(insert(Table.Catalog, {
    id: "c1",
    name: "Bad ID Catalog",
  })).rejects.toThrow("duplicate key");
});

test("Tag table tests", async (): Promise<void> => {
  let knex = await connection;

  let tags = idSorted(await withChildren(Table.Tag, from(knex, Table.Tag).where("id", "t2")));
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

  let albums = idSorted(await withChildren(Table.Album, from(knex, Table.Album).where("id", "a1")));
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
});

test("Person table tests", async (): Promise<void> => {
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
