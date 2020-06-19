import {
  initDB,
  resetDB,
  destroyDB,
  insertTestData,
  testData,
} from "pixelbin-database/build/test-helpers";
import { Table } from "pixelbin-database/build/types";

import { buildTestApp } from "../test-helpers";

beforeAll(initDB);
beforeEach(resetDB);
afterAll(destroyDB);

beforeEach(insertTestData);

const { agent } = buildTestApp(afterAll);

test("state", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });
});

test("login", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      "email": "someone1@nowhere.com",
      "fullname": "Someone 1",
      "hadCatalog": false,
      "verified": true,
      "catalogs": testData[Table.Catalog],
      "albums": testData[Table.Album],
      "people": testData[Table.Person],
      "tags": testData[Table.Tag],
    },
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      "email": "someone1@nowhere.com",
      "fullname": "Someone 1",
      "hadCatalog": false,
      "verified": true,
      "catalogs": testData[Table.Catalog],
      "albums": testData[Table.Album],
      "people": testData[Table.Person],
      "tags": testData[Table.Tag],
    },
  });

  response = await request
    .post("/api/logout")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });
});
