import { ErrorCode } from "../../../model";
import { expect, mockDateTime } from "../../../test-helpers";
import { insertTestData, testData } from "../../database/test-helpers";
import { Table } from "../../database/types";
import { buildTestApp } from "../test-helpers";

const agent = buildTestApp();

beforeEach(insertTestData);

test("state", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    apiHost: "api.localhost",
    user: null,
  });
});

test("login and logout", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    apiHost: "api.localhost",
    user: null,
  });

  let loginDT = mockDateTime("2019-03-04T22:22:22Z");

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
      email: "someone1@nowhere.com",
      fullname: "Someone 1",
      administrator: false,
      created: expect.toEqualDate("2020-01-01T00:00:00Z"),
      lastLogin: expect.toEqualDate(loginDT),
      verified: true,
      storage: [],
      catalogs: testData[Table.Catalog],
      albums: testData[Table.Album],
      people: testData[Table.Person],
      tags: testData[Table.Tag],
      searches: testData[Table.SavedSearch],
    },
    apiHost: "api.localhost",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      email: "someone1@nowhere.com",
      fullname: "Someone 1",
      administrator: false,
      created: expect.toEqualDate("2020-01-01T00:00:00Z"),
      lastLogin: expect.toEqualDate(loginDT),
      verified: true,
      storage: [],
      catalogs: testData[Table.Catalog],
      albums: testData[Table.Album],
      people: testData[Table.Person],
      tags: testData[Table.Tag],
      searches: testData[Table.SavedSearch],
    },
    apiHost: "api.localhost",
  });

  response = await request
    .post("/api/logout")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
  });
});

test("login failure", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
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
    code: ErrorCode.LoginFailed,
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
  });
});

test("signup", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
  });

  let createdDT = mockDateTime("2020-04-05T11:56:01Z");
  let loginDT = mockDateTime("2020-04-06T11:56:01Z");

  response = await request
    .put("/api/signup")
    .send({
      email: "foo@bar.com",
      fullname: "Me",
      password: "dfght56",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      email: "foo@bar.com",
      fullname: "Me",
      administrator: false,
      created: expect.toEqualDate(createdDT),
      lastLogin: expect.toEqualDate(loginDT),
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
      searches: [],
    },
    apiHost: "api.localhost",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      email: "foo@bar.com",
      fullname: "Me",
      administrator: false,
      created: expect.toEqualDate(createdDT),
      lastLogin: expect.toEqualDate(loginDT),
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
      searches: [],
    },
    apiHost: "api.localhost",
  });

  response = await request
    .post("/api/logout")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
  });

  loginDT = mockDateTime("2020-10-01T02:03:04Z");

  response = await request
    .post("/api/login")
    .send({
      email: "foo@bar.com",
      password: "dfght56",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      email: "foo@bar.com",
      fullname: "Me",
      administrator: false,
      created: expect.toEqualDate(createdDT),
      lastLogin: expect.toEqualDate(loginDT),
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
      searches: [],
    },
    apiHost: "api.localhost",
  });
});
