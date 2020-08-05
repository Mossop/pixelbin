import { buildTestDB, insertTestData, connection, testData } from "./test-helpers";
import { Table } from "./types";

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

test("Test user retrieval", async (): Promise<void> => {
  let dbConnection = await connection;

  let user = await dbConnection.getUser("noone", "unknown");
  expect(user).toBeUndefined();

  user = await dbConnection.getUser("someone1@nowhere.com", "password1");
  let { password, ...expected } = testData[Table.User][0];
  expect(user).toEqual(expected);

  user = await dbConnection.getUser("someone2@nowhere.com", "password2");
  let { password: password2, ...expected2 } = testData[Table.User][1];
  expect(user).toEqual(expected2);

  user = await dbConnection.getUser("someone2@nowhere.com", "password1");
  expect(user).toBeUndefined();
});
