import { idSorted } from "../../utils";
import { insert, withChildren, withParents, from } from "./queries";
import { insertTestData, testData, buildTestDB, connection } from "./test-helpers";
import { Table } from "./types";

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

test("Catalog table tests", async (): Promise<void> => {
  let dbConnection = await connection;

  // Should not allow duplicate IDs.
  await expect(insert(dbConnection.knex, Table.Catalog, {
    id: "c1",
    storage: "s1",
    name: "Bad ID Catalog",
  })).rejects.toThrow("duplicate key");
});

test("Tag table tests", async (): Promise<void> => {
  let dbConnection = await connection;

  let tags = idSorted(
    await withChildren(
      dbConnection.knex,
      Table.Tag,
      from(dbConnection.knex, Table.Tag).where("id", "t2"),
    ),
  );
  expect(tags).toHaveLength(4);
  expect(tags).toEqual([
    testData[Table.Tag][1],
    testData[Table.Tag][5],
    testData[Table.Tag][6],
    testData[Table.Tag][7],
  ]);

  tags = idSorted(
    await withParents(
      dbConnection.knex,
      Table.Tag,
      from(dbConnection.knex, Table.Tag).where("id", "t7"),
    ),
  );
  expect(tags).toHaveLength(3);
  expect(tags).toEqual([
    testData[Table.Tag][1],
    testData[Table.Tag][5],
    testData[Table.Tag][6],
  ]);

  // Should not allow duplicate IDs.
  await expect(insert(dbConnection.knex, Table.Tag, {
    id: "t1",
    catalog: "c1",
    parent: null,
    name: "Bad ID Tag",
  })).rejects.toThrow("duplicate key");

  // Should not allow duplicate name in the same parent.
  await expect(insert(dbConnection.knex, Table.Tag, {
    id: "t9",
    catalog: "c1",
    parent: "t2",
    name: "tag6",
  })).rejects.toThrow("unique constraint");

  // Disregarding case.
  await expect(insert(dbConnection.knex, Table.Tag, {
    id: "t9",
    catalog: "c1",
    parent: "t2",
    name: "tAg6",
  })).rejects.toThrow("unique constraint");

  // Should not allow adding to a different catalog to its parent.
  await expect(insert(dbConnection.knex, Table.Tag, {
    id: "t9",
    catalog: "c2",
    parent: "t2",
    name: "tag9",
  })).rejects.toThrow("foreign key constraint");
});

test("Album table tests", async (): Promise<void> => {
  let dbConnection = await connection;

  let albums = idSorted(
    await withChildren(
      dbConnection.knex,
      Table.Album,
      from(dbConnection.knex, Table.Album).where("id", "a1"),
    ),
  );
  expect(albums).toHaveLength(4);
  expect(albums).toEqual([
    testData[Table.Album][0],
    testData[Table.Album][2],
    testData[Table.Album][3],
    testData[Table.Album][4],
  ]);

  // Should not allow duplicate IDs.
  await expect(insert(dbConnection.knex, Table.Album, {
    id: "a1",
    catalog: "c1",
    parent: null,
    name: "Bad ID Album",
  })).rejects.toThrow("duplicate key");

  // Should not allow duplicate name in the same parent.
  await expect(insert(dbConnection.knex, Table.Album, {
    id: "a9",
    catalog: "c1",
    parent: "a1",
    name: "Album 3",
  })).rejects.toThrow("unique constraint");

  // Disregarding case.
  await expect(insert(dbConnection.knex, Table.Album, {
    id: "a9",
    catalog: "c1",
    parent: "a1",
    name: "alBuM 3",
  })).rejects.toThrow("unique constraint");

  // Should not allow adding to a different catalog to its parent.
  await expect(insert(dbConnection.knex, Table.Album, {
    id: "a9",
    catalog: "c2",
    parent: "a1",
    name: "Album 9",
  })).rejects.toThrow("foreign key constraint");
});

test("Person table tests", async (): Promise<void> => {
  let dbConnection = await connection;

  // Should not allow duplicate IDs.
  await expect(insert(dbConnection.knex, Table.Person, {
    id: "p1",
    catalog: "c3",
    name: "Bad ID Person",
  })).rejects.toThrow("duplicate key");

  // Should not allow duplicate name in the same catalog.
  await expect(insert(dbConnection.knex, Table.Person, {
    id: "p7",
    catalog: "c1",
    name: "Person 1",
  })).rejects.toThrow("unique constraint");

  // Disregarding case.
  await expect(insert(dbConnection.knex, Table.Person, {
    id: "p7",
    catalog: "c1",
    name: "peRsOn 1",
  })).rejects.toThrow("unique constraint");
});