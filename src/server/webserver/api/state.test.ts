import { insertTestData, testData } from "../../database/test-helpers";
import { Table } from "../../database/types";
import { ApiErrorCode } from "../error";
import { buildTestApp } from "../test-helpers";

const agent = buildTestApp();

beforeEach(insertTestData);

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

test("login and logout", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });

  response = await request
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

test("login failure", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });

  response = await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "badpassword",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ApiErrorCode.LoginFailed,
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });
});
