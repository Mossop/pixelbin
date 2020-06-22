import {
  initDB,
  resetDB,
  destroyDB,
  insertTestData,
  testData,
} from "pixelbin-database/build/test-helpers";
import { Table } from "pixelbin-database/build/types";
import { idSorted } from "pixelbin-utils";

import { ApiErrorCode } from "../error";
import { buildTestApp, expectUserState, fromCatalogs, catalogs } from "../test-helpers";

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
    .expect(401);

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

  expectUserState(response.body, {
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
  });
});

test("Create album", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .put("/api/album/create")
    .send({
      stub: null,
      catalog: "c1",
      name: "Bad user",
      parent: null,
    })
    .expect("Content-Type", "application/json")
    .expect(401);

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
    .put("/api/album/create")
    .send({
      stub: null,
      catalog: "c1",
      name: "Good user",
      parent: null,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let newAlbum = response.body;
  expect(newAlbum).toEqual({
    id: expect.stringMatching(/^A:[a-zA-Z0-9]+/),
    name: "Good user",
    stub: null,
    parent: null,
    catalog: "c1",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expectUserState(response.body, {
    "email": "someone1@nowhere.com",
    "fullname": "Someone 1",
    "hadCatalog": false,
    "verified": true,
    "catalogs": testData[Table.Catalog],
    "albums": [
      ...testData[Table.Album],
      newAlbum,
    ],
    "people": testData[Table.Person],
    "tags": testData[Table.Tag],
  });

  await request
    .post("/api/login")
    .send({
      email: "someone3@nowhere.com",
      password: "password3",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  response = await request
    .put("/api/album/create")
    .send({
      stub: null,
      catalog: "c1",
      name: "Bad catalog",
      parent: null,
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
  });
});

test("Edit album", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .patch("/api/album/edit")
    .send({
      id: "a1",
      name: "Bad name",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ApiErrorCode.NotLoggedIn,
  });

  await request
    .post("/api/login")
    .send({
      email: "someone2@nowhere.com",
      password: "password2",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  // Not including the ID is a failure.
  response = await request
    .patch("/api/album/edit")
    .send({
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
  });

  // Can't update albums in unowned catalogs.
  response = await request
    .patch("/api/album/edit")
    .send({
      id: "a6",
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
  });

  response = await request
    .patch("/api/album/edit")
    .send({
      id: "a1",
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let updatedAlbum = response.body;
  expect(updatedAlbum).toEqual({
    id: "a1",
    name: "New name",
    stub: null,
    parent: null,
    catalog: "c1",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  let albums = fromCatalogs("c1", testData[Table.Album]);
  albums[0] = updatedAlbum;
  expectUserState(response.body, {
    "email": "someone2@nowhere.com",
    "fullname": "Someone 2",
    "hadCatalog": false,
    "verified": true,
    "catalogs": catalogs("c1", testData[Table.Catalog]),
    "albums": albums,
    "people": fromCatalogs("c1", testData[Table.Person]),
    "tags": fromCatalogs("c1", testData[Table.Tag]),
  });
});
