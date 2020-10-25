import { ErrorCode, AWSResult, emptyMetadata } from "../../../model";
import { RelationType } from "../../../model/api";
import { expect, getStorageConfig } from "../../../test-helpers";
import { connection, insertTestData, testData } from "../../database/test-helpers";
import { Table } from "../../database/types";
import { buildTestApp, expectUserState, fromCatalogs, catalogs, storage } from "../test-helpers";
import { savedSearchIntoResponse } from "./state";

const agent = buildTestApp();

beforeEach(insertTestData);

async function testStorage(id: string): Promise<void> {
  let request = agent();

  let config = await getStorageConfig(id);
  if (!config) {
    console.warn("Skipping test due to missing secrets.");
    return;
  }

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .post("/api/storage/test")
    .send(config)
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    result: AWSResult.Success,
    message: null,
  });
}

test("Test AWS storage", async (): Promise<void> => {
  return testStorage("aws");
}, 30000);

test("Test Minio storage", async (): Promise<void> => {
  return testStorage("minio");
}, 30000);

test("Test Backblaze storage", async (): Promise<void> => {
  return testStorage("b2");
}, 30000);

test("Test Bad storage", async (): Promise<void> => {
  let request = agent();

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .post("/api/storage/test")
    .send({
      accessKeyId: "foo",
      secretAccessKey: "bar",
      endpoint: "http://nowhere.foo",
      bucket: "buckit",
      region: "us-east-1",
      path: null,
      publicUrl: null,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body.result).not.toBe(AWSResult.Success);
  expect(response.body).toMatchSnapshot();
});

test("Create storage", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body.user.storage).toEqual([]);

  response = await request
    .put("/api/storage/create")
    .send({
      name: "My storage",
      accessKeyId: "foo",
      secretAccessKey: "bar",
      endpoint: null,
      bucket: "buckit",
      region: "somewhere-1",
      path: null,
      publicUrl: null,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    id: expect.stringMatching(/^S:[a-zA-Z0-9]+/),
    name: "My storage",
    endpoint: null,
    bucket: "buckit",
    region: "somewhere-1",
    path: null,
    publicUrl: null,
  });
  let storageId = response.body.id;

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body.user.storage).toEqual([{
    id: storageId,
    name: "My storage",
    endpoint: null,
    bucket: "buckit",
    region: "somewhere-1",
    path: null,
    publicUrl: null,
  }]);
});

test("Create catalog", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .put("/api/catalog/create")
    .send({
      storage: "s1",
      name: "Bad user",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ErrorCode.NotLoggedIn,
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
      storage: "s1",
      name: "Wrong user",
    })
    .expect("Content-Type", "application/json")
    .expect(404);

  response = await request
    .put("/api/storage/create")
    .send({
      name: "My storage",
      accessKeyId: "foo",
      secretAccessKey: "bar",
      endpoint: null,
      bucket: "buckit",
      region: "my-region-001",
      path: null,
      publicUrl: null,
    })
    .expect("Content-Type", "application/json")
    .expect(200);
  let storageId = response.body.id;

  response = await request
    .put("/api/catalog/create")
    .send({
      storage: storageId,
      name: "Good user",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let newCatalog = response.body;
  expect(newCatalog).toEqual({
    id: expect.stringMatching(/^C:[a-zA-Z0-9]+/),
    storage: storageId,
    name: "Good user",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expectUserState(response.body, {
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    created: "2020-01-01T00:00:00.000Z",
    verified: true,
    storage: [{
      id: storageId,
      name: "My storage",
      endpoint: null,
      bucket: "buckit",
      region: "my-region-001",
      path: null,
      publicUrl: null,
    }],
    catalogs: [
      ...testData[Table.Catalog],
      newCatalog,
    ],
    albums: testData[Table.Album],
    people: testData[Table.Person],
    tags: testData[Table.Tag],
    searches: testData[Table.SavedSearch].map(savedSearchIntoResponse),
  });

  let ourStore = response.body.user.storage[0].id;

  // Can add to an existing storage.
  await request
    .put("/api/catalog/create")
    .send({
      storage: ourStore,
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
    .expect(404);
});

test("Edit catalog", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .patch("/api/catalog/edit")
    .send({
      id: "c1",
      name: "Bad user",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ErrorCode.NotLoggedIn,
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
    .patch("/api/catalog/edit")
    .send({
      id: "c1",
      name: "Updated",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let updated = response.body;
  expect(updated).toEqual({
    id: "c1",
    storage: "s1",
    name: "Updated",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  let expected = [...testData[Table.Catalog]];
  expected[0].name = "Updated";

  expectUserState(response.body, {
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    created: "2020-01-01T00:00:00.000Z",
    verified: true,
    storage: [],
    catalogs: expected,
    albums: testData[Table.Album],
    people: testData[Table.Person],
    tags: testData[Table.Tag],
    searches: testData[Table.SavedSearch].map(savedSearchIntoResponse),
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
    .patch("/api/catalog/edit")
    .send({
      id: "c1",
      name: "Bad edit",
    })
    .expect("Content-Type", "application/json")
    .expect(404);

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expectUserState(response.body, {
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    created: "2020-01-01T00:00:00.000Z",
    verified: true,
    storage: [],
    catalogs: expected,
    albums: testData[Table.Album],
    people: testData[Table.Person],
    tags: testData[Table.Tag],
    searches: testData[Table.SavedSearch].map(savedSearchIntoResponse),
  });
});

test("Create album", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .put("/api/album/create")
    .send({
      catalog: "c1",
      name: "Bad user",
      parent: null,
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ErrorCode.NotLoggedIn,
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
    parent: null,
    catalog: "c1",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expectUserState(response.body, {
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    created: "2020-01-01T00:00:00.000Z",
    verified: true,
    storage: [],
    catalogs: testData[Table.Catalog],
    albums: [
      ...testData[Table.Album],
      newAlbum,
    ],
    people: testData[Table.Person],
    tags: testData[Table.Tag],
    searches: testData[Table.SavedSearch].map(savedSearchIntoResponse),
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
      catalog: "c1",
      name: "Bad catalog",
      parent: null,
    })
    .expect("Content-Type", "application/json")
    .expect(404);

  expect(response.body).toEqual({
    code: ErrorCode.NotFound,
    data: {
      message: expect.stringContaining("Unknown Catalog."),
    },
  });
});

test("Edit album", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .patch("/api/album/edit")
    .send({
      id: "a1",
      name: "Bad name",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ErrorCode.NotLoggedIn,
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
    code: ErrorCode.InvalidData,
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
    .expect(404);

  expect(response.body).toEqual({
    code: ErrorCode.NotFound,
    data: {
      message: expect.stringContaining("Unknown Album."),
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
    parent: null,
    catalog: "c1",
  });

  response = await request
    .patch("/api/album/edit")
    .send({
      id: "a3",
      parent: null,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let updatedAlbum3 = response.body;
  expect(updatedAlbum3).toEqual({
    id: "a3",
    name: "Album 3",
    parent: null,
    catalog: "c1",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  let albums = fromCatalogs("c1", testData[Table.Album]);
  albums[0] = updatedAlbum;
  albums[2] = updatedAlbum3;
  expectUserState(response.body, {
    email: "someone2@nowhere.com",
    fullname: "Someone 2",
    created: "2010-01-01T00:00:00Z",
    verified: true,
    storage: storage([testData[Table.Storage][0]]),
    catalogs: catalogs("c1", testData[Table.Catalog]),
    albums: albums,
    people: fromCatalogs("c1", testData[Table.Person]),
    tags: fromCatalogs("c1", testData[Table.Tag]),
    searches: fromCatalogs("c1", testData[Table.SavedSearch]).map(savedSearchIntoResponse),
  });
});

test("List album and catalog", async (): Promise<void> => {
  /* eslint-disable-next-line */
  let ids = items => items.map(item => item.id);

  let request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let { id: id1 } = await user1Db.createMedia("c1", emptyMetadata);
  await user1Db.setMediaRelations(RelationType.Album, [id1], ["a1"]);

  let { id: id2 } = await user1Db.createMedia("c1", emptyMetadata);
  await user1Db.setMediaRelations(RelationType.Album, [id2], ["a3"]);

  let { id: id3 } = await user1Db.createMedia("c1", emptyMetadata);
  await user1Db.setMediaRelations(RelationType.Album, [id3], ["a1", "a3"]);

  let { id: id4 } = await user1Db.createMedia("c1", emptyMetadata);
  await user1Db.setMediaRelations(RelationType.Album, [id4], ["a2"]);

  let response = await request
    .get("/api/album/list")
    .query({
      id: "a1",
      recursive: false,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(ids(response.body)).toInclude([
    id1,
    id3,
  ]);

  response = await request
    .get("/api/album/list")
    .query({
      id: "a3",
      recursive: false,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(ids(response.body)).toInclude([
    id2,
    id3,
  ]);

  response = await request
    .get("/api/album/list")
    .query({
      id: "a1",
      recursive: true,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(ids(response.body)).toInclude([
    id1,
    id2,
    id3,
  ]);

  response = await request
    .get("/api/catalog/list")
    .query({
      id: "c1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(ids(response.body)).toInclude([
    id1,
    id2,
    id3,
    id4,
  ]);
});

test("Create Tag", async (): Promise<void> => {
  let request = agent();

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
    code: ErrorCode.NotLoggedIn,
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
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    created: "2020-01-01T00:00:00Z",
    verified: true,
    storage: [],
    catalogs: testData[Table.Catalog],
    albums: testData[Table.Album],
    people: testData[Table.Person],
    tags: [
      ...testData[Table.Tag],
      newTag,
    ],
    searches: testData[Table.SavedSearch].map(savedSearchIntoResponse),
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
    .expect(404);

  expect(response.body).toEqual({
    code: ErrorCode.NotFound,
    data: {
      message: expect.stringContaining("Unknown Catalog."),
    },
  });
});

test("Edit tag", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .patch("/api/tag/edit")
    .send({
      id: "c1",
      name: "Bad name",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ErrorCode.NotLoggedIn,
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
    code: ErrorCode.InvalidData,
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
    .expect(404);

  expect(response.body).toEqual({
    code: ErrorCode.NotFound,
    data: {
      message: expect.stringContaining("Unknown Tag."),
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
    email: "someone2@nowhere.com",
    fullname: "Someone 2",
    created: "2010-01-01T00:00:00Z",
    verified: true,
    storage: storage([testData[Table.Storage][0]]),
    catalogs: catalogs("c1", testData[Table.Catalog]),
    albums: fromCatalogs("c1", testData[Table.Album]),
    people: fromCatalogs("c1", testData[Table.Person]),
    tags: tags,
    searches: fromCatalogs("c1", testData[Table.SavedSearch]).map(savedSearchIntoResponse),
  });
});

test("Find Tag", async (): Promise<void> => {
  let request = agent();

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .post("/api/tag/find")
    .send({
      catalog: "c1",
      tags: ["tag2", "Tag6"],
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    id: "t2",
    parent: null,
    name: "tag2",
    catalog: "c1",
  }, {
    id: "t6",
    parent: "t2",
    name: "Tag6",
    catalog: "c1",
  }]);

  response = await request
    .post("/api/tag/find")
    .send({
      catalog: "c1",
      tags: ["tag2", "tag6", "newtag"],
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    id: "t2",
    parent: null,
    name: "tag2",
    catalog: "c1",
  }, {
    id: "t6",
    parent: "t2",
    name: "tag6",
    catalog: "c1",
  }, {
    id: expect.stringMatching(/T:[a-zA-Z0-9]+/),
    parent: "t6",
    name: "newtag",
    catalog: "c1",
  }]);
});

test("Create Person", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .put("/api/person/create")
    .send({
      catalog: "c1",
      name: "Bad user",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ErrorCode.NotLoggedIn,
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
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    created: "2020-01-01T00:00:00Z",
    verified: true,
    storage: [],
    catalogs: testData[Table.Catalog],
    albums: testData[Table.Album],
    people: [
      ...testData[Table.Person],
      newPerson,
    ],
    tags: testData[Table.Tag],
    searches: testData[Table.SavedSearch].map(savedSearchIntoResponse),
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
    .expect(404);

  expect(response.body).toEqual({
    code: ErrorCode.NotFound,
    data: {
      message: expect.stringContaining("Unknown Catalog."),
    },
  });
});

test("Edit person", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .patch("/api/person/edit")
    .send({
      id: "c1",
      name: "Bad name",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ErrorCode.NotLoggedIn,
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
    code: ErrorCode.InvalidData,
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
    .expect(404);

  expect(response.body).toEqual({
    code: ErrorCode.NotFound,
    data: {
      message: expect.stringContaining("Unknown Person."),
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
    email: "someone2@nowhere.com",
    fullname: "Someone 2",
    created: "2010-01-01T00:00:00Z",
    verified: true,
    storage: storage([testData[Table.Storage][0]]),
    catalogs: catalogs("c1", testData[Table.Catalog]),
    albums: fromCatalogs("c1", testData[Table.Album]),
    people: people,
    tags: fromCatalogs("c1", testData[Table.Tag]),
    searches: fromCatalogs("c1", testData[Table.SavedSearch]).map(savedSearchIntoResponse),
  });
});
