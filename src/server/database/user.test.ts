import moment from "moment-timezone";

import { mockedFunction, expect } from "../../test-helpers";
import { buildTestDB, insertTestData, connection, testData } from "./test-helpers";
import { Table, Tables } from "./types";

jest.mock("moment-timezone", (): unknown => {
  const actualMoment = jest.requireActual("moment-timezone");
  let moment = jest.fn(actualMoment);
  // @ts-ignore: Mocking.
  moment.tz = jest.fn(actualMoment.tz);
  // @ts-ignore: Mocking.
  moment.isMoment = actualMoment.isMoment;
  return moment;
});

const mockedMoment = mockedFunction(moment);
const realMoment: typeof moment = jest.requireActual("moment-timezone");

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

test("Test user retrieval", async (): Promise<void> => {
  let dbConnection = await connection;

  let user = await dbConnection.loginUser("noone", "unknown");
  expect(user).toBeUndefined();

  let loginMoment = realMoment.tz("2020-09-02T13:18:00", "UTC");
  mockedMoment.mockReturnValueOnce(loginMoment);

  user = await dbConnection.loginUser("someone1@nowhere.com", "password1");
  let { password, lastLogin, ...expected } = testData[Table.User][0];
  expect(user).toEqual({
    ...expected,
    created: expect.toEqualDate(expected.created),
  });

  let listed = (await dbConnection.listUsers())
    .find((user: Omit<Tables.User, "password">): boolean => {
      return user.email == "someone1@nowhere.com";
    });
  expect(listed).toEqual({
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    created: expect.toEqualDate("2020-01-01T00:00:00Z"),
    lastLogin: expect.toEqualDate(loginMoment),
    verified: true,
  });

  loginMoment = realMoment.tz("2020-08-04T12:17:00", "UTC");
  mockedMoment.mockReturnValueOnce(loginMoment);

  user = await dbConnection.loginUser("someone2@nowhere.com", "password2");
  let { password: password2, lastLogin: lastLogin2, ...expected2 } = testData[Table.User][1];
  expect(user).toEqual({
    ...expected2,
    created: expect.toEqualDate(expected2.created),
  });

  listed = (await dbConnection.listUsers())
    .find((user: Omit<Tables.User, "password">): boolean => {
      return user.email == "someone2@nowhere.com";
    });
  expect(listed).toEqual({
    email: "someone2@nowhere.com",
    fullname: "Someone 2",
    created: expect.toEqualDate("2010-01-01T00:00:00Z"),
    lastLogin: expect.toEqualDate(loginMoment),
    verified: true,
  });

  user = await dbConnection.loginUser("someone2@nowhere.com", "password1");
  expect(user).toBeUndefined();
});

test("User creation", async (): Promise<void> => {
  let dbConnection = await connection;

  let createdMoment = realMoment.tz("2015-02-03T05:56:45", "UTC");
  mockedMoment.mockImplementationOnce(() => createdMoment);

  let user = await dbConnection.createUser({
    email: "newuser@foo.bar.com",
    fullname: "Dave Townsend",
    password: "foobar57",
  });

  expect(user).toEqual({
    email: "newuser@foo.bar.com",
    fullname: "Dave Townsend",
    created: expect.toEqualDate(createdMoment),
    verified: true,
  });

  let listed = (await dbConnection.listUsers())
    .find((user: Omit<Tables.User, "password">): boolean => {
      return user.email == "newuser@foo.bar.com";
    });
  expect(listed).toEqual({
    email: "newuser@foo.bar.com",
    fullname: "Dave Townsend",
    created: expect.toEqualDate(createdMoment),
    lastLogin: null,
    verified: true,
  });

  let loginMoment = realMoment.tz("2020-03-01T13:18:00", "UTC");
  mockedMoment.mockReturnValueOnce(loginMoment);

  let found = await dbConnection.loginUser("newuser@foo.bar.com", "foobar57");

  expect(found).toEqual({
    email: "newuser@foo.bar.com",
    fullname: "Dave Townsend",
    created: expect.toEqualDate(createdMoment),
    verified: true,
  });

  listed = (await dbConnection.listUsers())
    .find((user: Omit<Tables.User, "password">): boolean => {
      return user.email == "newuser@foo.bar.com";
    });
  expect(listed).toEqual({
    email: "newuser@foo.bar.com",
    fullname: "Dave Townsend",
    created: expect.toEqualDate(createdMoment),
    lastLogin: expect.toEqualDate(loginMoment),
    verified: true,
  });
});

test("List users", async (): Promise<void> => {
  let dbConnection = await connection;

  let users = await dbConnection.listUsers();
  expect(users).toInclude([{
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    created: expect.toEqualDate("2020-01-01T00:00:00Z"),
    lastLogin: null,
    verified: true,
  }, {
    email: "someone2@nowhere.com",
    fullname: "Someone 2",
    created: expect.toEqualDate("2010-01-01T00:00:00Z"),
    lastLogin: expect.toEqualDate("2020-02-02T00:00:00Z"),
    verified: true,
  }, {
    email: "someone3@nowhere.com",
    fullname: "Someone 3",
    created: expect.toEqualDate("2015-01-01T00:00:00Z"),
    lastLogin: expect.toEqualDate("2020-03-03T00:00:00Z"),
    verified: true,
  }]);
});
