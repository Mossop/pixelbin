import {
  initDB,
  resetDB,
  destroyDB,
  insertTestData,
  testData,
} from "pixelbin-database/build/test-helpers";
import { Table } from "pixelbin-database/build/types";

import { ApiErrorCode } from "../error";
import { buildTestApp } from "../test-helpers";

beforeAll(initDB);
beforeEach(resetDB);
afterAll(destroyDB);

beforeEach(insertTestData);

const { agent } = buildTestApp(afterAll);

test("Create catalog", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .put("/api/catalog/create")
    .send({
      name: "Bad user",
    })
    .expect("Content-Type", "application/json")
    .expect(403);

  expect(response.body).toEqual({
    code: ApiErrorCode.NotLoggedIn,
  });

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  response = await request
    .put("/api/catalog/create")
    .send({
      name: "Good user",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let newCatalog = response.body;
  expect(newCatalog).toEqual({
    id: expect.stringMatching(/^C:[a-zA-Z0-9]+/),
    name: "Good user",
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
      "catalogs": [
        ...testData[Table.Catalog],
        newCatalog,
      ],
      "albums": testData[Table.Album],
      "people": testData[Table.Person],
      "tags": testData[Table.Tag],
    },
  });
});
