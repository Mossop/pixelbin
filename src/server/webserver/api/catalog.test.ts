import {
  buildTestDB,
  insertTestData,
  testData,
} from "../../database/test-helpers";
import { Table } from "../../database/types";
import { ApiErrorCode } from "../error";
import { buildTestApp, expectUserState, fromCatalogs, catalogs } from "../test-helpers";

buildTestDB();

beforeEach(insertTestData);

const agent = buildTestApp();

test("Create catalog", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .put("/api/catalog/create")
    .send({
      storage: {
        name: "My storage",
        accessKeyId: "foo",
        secretAccessKey: "bar",
        region: "Anywhere",
        endpoint: null,
        publicUrl: null,
      },
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
      storage: {
        name: "My storage",
        accessKeyId: "foo",
        secretAccessKey: "bar",
        region: "Anywhere",
        endpoint: null,
        publicUrl: null,
      },
      name: "Good user",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let newCatalog = response.body;
  expect(newCatalog).toEqual({
    id: expect.stringMatching(/^C:[a-zA-Z0-9]+/),
    storage: expect.stringMatching(/^S:[a-zA-Z0-9]+/),
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

  // Can add to an existing storage.
  await request
    .put("/api/catalog/create")
    .send({
      storage: "s1",
      name: "Existing catalog",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  await request
    .post("/api/login")
    .send({
      email: "someone2@nowhere.com",
      password: "password2",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  // But not if the storage is not accessible by the user.
  await request
    .put("/api/catalog/create")
    .send({
      storage: "s3",
      name: "Inaccessible",
    })
    .expect("Content-Type", "application/json")
    .expect(400);
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
    data: {
      message: expect.stringContaining("Invalid user or catalog"),
    },
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
    data: {
      message: expect.stringContaining("decoder failed at key \"id\""),
    },
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
    data: {
      message: expect.stringContaining("Invalid user or album"),
    },
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

test("Create Tag", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .put("/api/tag/create")
    .send({
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
    .put("/api/tag/create")
    .send({
      catalog: "c1",
      name: "Good user",
      parent: null,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let newTag = response.body;
  expect(newTag).toEqual({
    id: expect.stringMatching(/^T:[a-zA-Z0-9]+/),
    name: "Good user",
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
    "albums": testData[Table.Album],
    "people": testData[Table.Person],
    "tags": [
      ...testData[Table.Tag],
      newTag,
    ],
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
    .put("/api/tag/create")
    .send({
      catalog: "c1",
      name: "Bad catalog",
      parent: null,
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
    data: {
      message: expect.stringContaining("Invalid user or catalog"),
    },
  });
});

test("Edit tag", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .patch("/api/tag/edit")
    .send({
      id: "c1",
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
    .patch("/api/tag/edit")
    .send({
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
    data: {
      message: expect.stringContaining("decoder failed at key \"id\""),
    },
  });

  // Can't update tags in unowned catalogs.
  response = await request
    .patch("/api/tag/edit")
    .send({
      id: "t5",
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
    data: {
      message: expect.stringContaining("Invalid user or album"),
    },
  });

  response = await request
    .patch("/api/tag/edit")
    .send({
      id: "t1",
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let updatedTag = response.body;
  expect(updatedTag).toEqual({
    id: "t1",
    name: "New name",
    parent: null,
    catalog: "c1",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  let tags = fromCatalogs("c1", testData[Table.Tag]);
  tags[0] = updatedTag;
  expectUserState(response.body, {
    "email": "someone2@nowhere.com",
    "fullname": "Someone 2",
    "hadCatalog": false,
    "verified": true,
    "catalogs": catalogs("c1", testData[Table.Catalog]),
    "albums": fromCatalogs("c1", testData[Table.Album]),
    "people": fromCatalogs("c1", testData[Table.Person]),
    "tags": tags,
  });
});

test("Create Person", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .put("/api/person/create")
    .send({
      catalog: "c1",
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
    .put("/api/person/create")
    .send({
      catalog: "c1",
      name: "Good user",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let newPerson = response.body;
  expect(newPerson).toEqual({
    id: expect.stringMatching(/^P:[a-zA-Z0-9]+/),
    name: "Good user",
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
    "albums": testData[Table.Album],
    "people": [
      ...testData[Table.Person],
      newPerson,
    ],
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
    .put("/api/person/create")
    .send({
      catalog: "c1",
      name: "Bad catalog",
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
    data: {
      message: expect.stringContaining("Invalid user or catalog"),
    },
  });
});

test("Edit person", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .patch("/api/person/edit")
    .send({
      id: "c1",
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
    .patch("/api/person/edit")
    .send({
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
    data: {
      message: expect.stringContaining("decoder failed at key \"id\""),
    },
  });

  // Can't update people in unowned catalogs.
  response = await request
    .patch("/api/person/edit")
    .send({
      id: "p4",
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: ApiErrorCode.InvalidData,
    data: {
      message: expect.stringContaining("Invalid user or album"),
    },
  });

  response = await request
    .patch("/api/person/edit")
    .send({
      id: "p1",
      name: "New name",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let updatedPerson = response.body;
  expect(updatedPerson).toEqual({
    id: "p1",
    name: "New name",
    catalog: "c1",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  let people = fromCatalogs("c1", testData[Table.Person]);
  people[0] = updatedPerson;
  expectUserState(response.body, {
    "email": "someone2@nowhere.com",
    "fullname": "Someone 2",
    "hadCatalog": false,
    "verified": true,
    "catalogs": catalogs("c1", testData[Table.Catalog]),
    "albums": fromCatalogs("c1", testData[Table.Album]),
    "people": people,
    "tags": fromCatalogs("c1", testData[Table.Tag]),
  });
});
