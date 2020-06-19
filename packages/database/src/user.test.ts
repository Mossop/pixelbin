import { buildTestDB, insertTestData, testData } from "./test-helpers";
import { Table } from "./types";
import { getUser } from "./user";

buildTestDB({
  beforeAll,
  beforeEach,
  afterAll,
});

beforeEach((): Promise<void> => {
  return insertTestData();
});

test("Test user retrieval", async (): Promise<void> => {
  let user = await getUser("noone", "unknown");
  expect(user).toBeUndefined();

  user = await getUser("someone1@nowhere.com", "password1");
  expect(user).toEqual(testData[Table.User][0]);

  user = await getUser("someone2@nowhere.com", "password2");
  expect(user).toEqual(testData[Table.User][1]);

  user = await getUser("someone2@nowhere.com", "password1");
  expect(user).toBeUndefined();
});
