import { LocalZone } from "luxon";

import { expect } from "../../test-helpers";
import { hasTimezone, isoDateTime, now } from "../../utils";
import type { DatabaseConnection } from "./connection";
import { parseDate, parseUTCDate } from "./connection";
import { from, insert, drop, into } from "./queries";
import { connection, buildTestDB } from "./test-helpers";
import { Table } from "./types";

buildTestDB();

test("Basic database connection", async (): Promise<void> => {
  let dbConnection = await connection;

  await insert(dbConnection.knex, Table.User, {
    email: "someone1@nowhere.com",
    administrator: false,
    password: "foo",
    fullname: "Dave",
    lastLogin: null,
    verified: true,
    created: now(),
  });

  await insert(dbConnection.knex, Table.Storage, {
    id: "s1",
    owner: "someone1@nowhere.com",
    name: "Test storage",
    accessKeyId: "bar",
    secretAccessKey: "foo",
    endpoint: "anywhere",
    bucket: "buckit",
    region: "thisplace",
    path: null,
    publicUrl: null,
  });

  await insert(dbConnection.knex, Table.Catalog, {
    id: "foo",
    storage: "s1",
    name: "bar",
  });

  let results = await from(dbConnection.knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    storage: "s1",
    name: "bar",
  });

  await into(dbConnection.knex, Table.Catalog).where({ id: "foo" }).update({ name: "baz" });

  results = await from(dbConnection.knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    storage: "s1",
    name: "baz",
  });

  await expect(
    dbConnection.inTransaction("inner", async (dbConnection: DatabaseConnection): Promise<void> => {
      await drop(dbConnection.knex, Table.Catalog).where({ id: "foo" });

      let results = await from(dbConnection.knex, Table.Catalog).select("*");
      expect(results).toHaveLength(0);

      throw new Error("Made up error");
    }),
  ).rejects.toThrow("Made up error");

  results = await from(dbConnection.knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
});

test("date parsing", () => {
  let parsed = parseDate("2020-05-06 17:01:02.0+00");
  expect(parsed).toEqualDate("2020-05-06T17:01:02");
  expect(parsed.hour).toBe(17);
  expect(parsed.offset).toBe(new LocalZone().offset(parsed.toMillis()));
  expect(isoDateTime(parsed)).toBe("2020-05-06T17:01:02.000");
  expect(hasTimezone(parsed)).toBeFalsy();

  parsed = parseUTCDate("2020-05-06 17:01:02.0+00");
  expect(parsed).toEqualDate("2020-05-06T17:01:02Z");
  expect(parsed.hour).toBe(17);
  expect(parsed.offset).toBe(0);
  expect(isoDateTime(parsed)).toBe("2020-05-06T17:01:02.000Z");
  expect(hasTimezone(parsed)).toBeTruthy();

  parsed = parseUTCDate("2020-05-06 17:01:02.0-07");
  expect(parsed).toEqualDate("2020-05-07T00:01:02Z");
  expect(parsed.hour).toBe(0);
  expect(parsed.offset).toBe(0);
  expect(isoDateTime(parsed)).toBe("2020-05-07T00:01:02.000Z");
  expect(hasTimezone(parsed)).toBeTruthy();
});
