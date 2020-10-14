import {
  Query,
  Join,
  Operator,
  Modifier,
  checkQuery,
  RelationType,
  emptyMetadata,
} from "../../model";
import { idSorted, parseDateTime } from "../../utils";
import { UserScopedConnection } from "./connection";
import { buildTestDB, connection, insertData, insertTestData } from "./test-helpers";
import { Table } from "./types";

buildTestDB();

beforeEach(async (): Promise<void> => {
  await insertTestData();
  return insertData({
    [Table.Media]: [{
      ...emptyMetadata,
      id: "m1",
      catalog: "c1",
      deleted: false,
      created: parseDateTime("2020-01-02T04:05:06"),
      updated: parseDateTime("2020-01-02T04:05:06"),

      title: "A test title",
      description: "A test description",
      rating: 3,
      longitude: 56,
      latitude: -120,
      taken: parseDateTime("2019-05-03T06:05:06"),
    }, {
      ...emptyMetadata,
      id: "m2",
      catalog: "c1",
      deleted: false,
      created: parseDateTime("2020-01-04T04:05:06"),
      updated: parseDateTime("2020-01-04T04:05:06"),

      title: "A different title",
      description: "Another description",
      rating: 5,
      longitude: 78,
      latitude: -100,
      taken: parseDateTime("2016-03-03T06:05:06"),
    }, {
      ...emptyMetadata,
      id: "m3",
      catalog: "c1",
      deleted: false,
      created: parseDateTime("2020-01-02T04:05:06"),
      updated: parseDateTime("2020-01-02T04:05:06"),

      description: "A third description",
      longitude: -34,
      latitude: 28,
      taken: parseDateTime("2017-06-03T06:05:06"),
    }, {
      ...emptyMetadata,
      id: "m4",
      catalog: "c2",
      deleted: false,
      created: parseDateTime("2020-02-01T04:05:06"),
      updated: parseDateTime("2020-02-01T04:05:06"),

      description: "A test description",
      rating: 3,
      longitude: -47,
      latitude: 76,
      taken: parseDateTime("2018-06-03T06:05:06"),
    }, {
      ...emptyMetadata,
      id: "m5",
      catalog: "c1",
      deleted: false,
      created: parseDateTime("2002-02-01T04:05:06"),
      updated: parseDateTime("2002-02-01T04:05:06"),
    }, {
      ...emptyMetadata,
      id: "m6",
      catalog: "c1",
      deleted: false,
      created: parseDateTime("2004-02-01T04:05:06"),
      updated: parseDateTime("2004-02-01T04:05:06"),
    }],
    [Table.MediaAlbum]: [{
      catalog: "c1",
      media: "m1",
      album: "a3",
    }, {
      catalog: "c1",
      media: "m2",
      album: "a2",
    }, {
      catalog: "c1",
      media: "m3",
      album: "a1",
    }, {
      catalog: "c1",
      media: "m6",
      album: "a3",
    }, {
      catalog: "c1",
      media: "m6",
      album: "a2",
    }],
  });
});

function ids(items: { id: string }[]): string[] {
  return idSorted(items).map((item: { id: string }) => item.id);
}

async function search(userDb: UserScopedConnection, search: Query): Promise<string[]> {
  return ids(await userDb.searchMedia("c1", search));
}

test("Correctness", async (): Promise<void> => {
  let dbConnection = await connection;
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  await expect(search(user2Db, {
    type: "compound",
    join: Join.And,
    invert: false,
    queries: [],
  })).resolves.toEqual([
    "m1",
    "m2",
    "m3",
    "m5",
    "m6",
  ]);
});

test("Numeric metadata search", async (): Promise<void> => {
  let dbConnection = await connection;
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.Equal,
    value: 5,
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.Equal,
    value: "3",
  })).rejects.toThrow("Expected a 'number' value for operator 'equal' but got 'string'.");

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.Equal,
    value: 3,
  })).resolves.toEqual([
    "m1",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.Equal,
    value: 3,
  })).resolves.toEqual([
    "m2",
    "m3",
    "m5",
    "m6",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.LessThan,
    value: 4,
  })).resolves.toEqual([
    "m1",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.LessThan,
    value: 4,
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.LessThanOrEqual,
    value: 3,
  })).resolves.toEqual([
    "m1",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.LessThanOrEqual,
    value: 3,
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.LessThanOrEqual,
    value: 4,
  })).resolves.toEqual([
    "m1",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.LessThanOrEqual,
    value: 4,
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.Empty,
    value: null,
  })).resolves.toEqual([
    "m3",
    "m5",
    "m6",
  ]);

  expect(() => checkQuery({
    invert: true,
    type: "field",
    field: "rating",
    modifier: null,
    operator: Operator.LessThanOrEqual,
    value: "4bad",
  })).toThrow("Expected a 'number' value for operator 'lessthanequal' but got 'string'.");
});

test("String metadata search", async (): Promise<void> => {
  let dbConnection = await connection;
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "title",
    modifier: null,
    operator: Operator.Equal,
    value: "A different title",
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.Equal,
    value: "A test description",
  })).resolves.toEqual([
    "m1",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.LessThan,
    value: "An",
  })).rejects.toThrow("Cannot apply operator 'lessthan' to a 'string' value.");

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.EndsWith,
    value: "description",
  })).resolves.toEqual([
    "m1",
    "m2",
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.StartsWith,
    value: "A",
  })).resolves.toEqual([
    "m1",
    "m2",
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.StartsWith,
    value: "An",
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.Contains,
    value: "other",
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.Contains,
    value: "descrip",
  })).resolves.toEqual([
    "m1",
    "m2",
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.EndsWith,
    value: "descrip",
  })).resolves.toEqual([]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.StartsWith,
    value: "descrip",
  })).resolves.toEqual([]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "description",
    modifier: null,
    operator: Operator.StartsWith,
    value: "descrip",
  })).resolves.toEqual([
    "m1",
    "m2",
    "m3",
    "m5",
    "m6",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "title",
    modifier: null,
    operator: Operator.Empty,
    value: null,
  })).resolves.toEqual([
    "m1",
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "description",
    modifier: Modifier.Length,
    operator: Operator.Equal,
    value: 19,
  })).resolves.toEqual([
    "m2",
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "title",
    modifier: Modifier.Length,
    operator: Operator.Equal,
    value: 17,
  })).resolves.toEqual([
    "m1",
    "m3",
    "m5",
    "m6",
  ]);
});

test("Date metadata search", async (): Promise<void> => {
  let dbConnection = await connection;
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "taken",
    modifier: null,
    operator: Operator.Equal,
    value: parseDateTime("2019-05-03T06:05:06Z"),
  })).resolves.toEqual([
    "m1",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "taken",
    modifier: null,
    operator: Operator.Equal,
    value: parseDateTime("2019-05-03T06:05:06-07:00"),
  })).resolves.toEqual([
    "m1",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "taken",
    modifier: null,
    operator: Operator.Equal,
    value: parseDateTime("2019-05-03T06:05:06Z"),
  })).resolves.toEqual([
    "m2",
    "m3",
    "m5",
    "m6",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "taken",
    modifier: null,
    operator: Operator.LessThan,
    value: parseDateTime("2018-01-01T00:00:00Z"),
  })).resolves.toEqual([
    "m2",
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "field",
    field: "taken",
    modifier: null,
    operator: Operator.LessThan,
    value: parseDateTime("2018-01-01T00:00:00Z"),
  })).resolves.toEqual([
    "m1",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "taken",
    modifier: Modifier.Year,
    operator: Operator.Equal,
    value: 2016,
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "field",
    field: "taken",
    modifier: Modifier.Month,
    operator: Operator.LessThanOrEqual,
    value: 5,
  })).resolves.toEqual([
    "m1",
    "m2",
  ]);
});

test("Compound search", async (): Promise<void> => {
  let dbConnection = await connection;
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    join: Join.And,
    queries: [{
      invert: false,
      type: "field",
      field: "description",
      modifier: Modifier.Length,
      operator: Operator.Equal,
      value: 19,
    }, {
      invert: false,
      type: "field",
      field: "longitude",
      modifier: null,
      operator: Operator.LessThan,
      value: 0,
    }],
  })).resolves.toEqual([
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    join: Join.Or,
    queries: [{
      invert: false,
      type: "field",
      field: "title",
      modifier: null,
      operator: Operator.Contains,
      value: "different",
    }, {
      invert: false,
      type: "field",
      field: "longitude",
      modifier: null,
      operator: Operator.LessThan,
      value: 0,
    }],
  })).resolves.toEqual([
    "m2",
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    join: Join.And,
    queries: [{
      invert: false,
      type: "compound",
      join: Join.Or,
      queries: [{
        invert: false,
        type: "field",
        field: "title",
        modifier: null,
        operator: Operator.Contains,
        value: "different",
      }, {
        invert: false,
        type: "field",
        field: "longitude",
        modifier: null,
        operator: Operator.LessThan,
        value: 0,
      }],
    }, {
      invert: true,
      type: "field",
      field: "title",
      modifier: null,
      operator: Operator.Empty,
    }],
  })).resolves.toEqual([
    "m2",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    join: Join.Or,
    queries: [{
      invert: true,
      type: "compound",
      join: Join.Or,
      queries: [{
        invert: false,
        type: "field",
        field: "title",
        modifier: null,
        operator: Operator.Contains,
        value: "different",
      }, {
        invert: false,
        type: "field",
        modifier: null,
        field: "longitude",
        operator: Operator.LessThan,
        value: 0,
      }],
    }, {
      invert: false,
      type: "field",
      field: "description",
      modifier: null,
      operator: Operator.Contains,
      value: "third",
    }],
  })).resolves.toEqual([
    "m1",
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    join: Join.And,
    queries: [{
      invert: false,
      type: "field",
      field: "description",
      modifier: null,
      operator: Operator.EndsWith,
      value: "description",
    }, {
      invert: true,
      type: "field",
      field: "title",
      modifier: null,
      operator: Operator.Contains,
      value: "different",
    }],
  })).resolves.toEqual([
    "m1",
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    join: Join.And,
    queries: [{
      invert: true,
      type: "field",
      field: "rating",
      modifier: null,
      operator: Operator.Empty,
    }, {
      invert: true,
      type: "field",
      field: "title",
      modifier: null,
      operator: Operator.Contains,
      value: "different",
    }],
  })).resolves.toEqual([
    "m1",
  ]);
});

test("Album search", async (): Promise<void> => {
  let dbConnection = await connection;
  let user2Db = dbConnection.forUser("someone2@nowhere.com");

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    relation: RelationType.Album,
    join: Join.Or,
    queries: [{
      invert: false,
      type: "field",
      field: "name",
      modifier: null,
      operator: Operator.Equal,
      value: "Album 3",
    }, {
      invert: false,
      type: "field",
      field: "name",
      modifier: null,
      operator: Operator.EndsWith,
      value: "2",
    }],
  })).resolves.toEqual([
    "m1",
    "m2",
    "m6",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "compound",
    relation: RelationType.Album,
    join: Join.Or,
    queries: [{
      invert: false,
      type: "field",
      field: "name",
      modifier: null,
      operator: Operator.Equal,
      value: "Album 3",
    }, {
      invert: false,
      type: "field",
      field: "name",
      modifier: null,
      operator: Operator.EndsWith,
      value: "2",
    }],
  })).resolves.toEqual([
    "m3",
    "m5",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    relation: RelationType.Album,
    join: Join.Or,
    queries: [{
      invert: false,
      type: "field",
      field: "name",
      modifier: null,
      operator: Operator.Equal,
      value: "Album 1",
    }],
  })).resolves.toEqual([
    "m3",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    relation: RelationType.Album,
    recursive: true,
    join: Join.Or,
    queries: [{
      invert: false,
      type: "field",
      field: "name",
      modifier: null,
      operator: Operator.Equal,
      value: "Album 1",
    }],
  })).resolves.toEqual([
    "m1",
    "m3",
    "m6",
  ]);

  await expect(search(user2Db, {
    invert: false,
    type: "compound",
    relation: RelationType.Album,
    recursive: true,
    join: Join.Or,
    queries: [{
      invert: true,
      type: "field",
      field: "name",
      modifier: null,
      operator: Operator.Equal,
      value: "Album 1",
    }],
  })).resolves.toEqual([
    "m1",
    "m2",
    "m6",
  ]);

  await expect(search(user2Db, {
    invert: true,
    type: "compound",
    relation: RelationType.Album,
    recursive: true,
    join: Join.Or,
    queries: [{
      invert: false,
      type: "field",
      field: "name",
      modifier: null,
      operator: Operator.Equal,
      value: "Album 1",
    }],
  })).resolves.toEqual([
    "m2",
    "m5",
  ]);
});
