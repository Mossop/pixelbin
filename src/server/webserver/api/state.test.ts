import { ErrorCode } from "../../../model";
import { expect, mockDateTime } from "../../../test-helpers";
import { insertTestData, testData } from "../../database/test-helpers";
import { Table } from "../../database/types";
import { buildTestApp, fixedState } from "../test-helpers";

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
    ...fixedState,
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
    ...fixedState,
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
      catalogs: expect.toInclude(testData[Table.Catalog]),
      albums: expect.toInclude(testData[Table.Album]),
      people: expect.toInclude(testData[Table.Person]),
      tags: expect.toInclude(testData[Table.Tag]),
      searches: expect.toInclude(testData[Table.SavedSearch]),
    },
    apiHost: "api.localhost",
    ...fixedState,
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
      catalogs: expect.toInclude(testData[Table.Catalog]),
      albums: expect.toInclude(testData[Table.Album]),
      people: expect.toInclude(testData[Table.Person]),
      tags: expect.toInclude(testData[Table.Tag]),
      searches: expect.toInclude(testData[Table.SavedSearch]),
    },
    apiHost: "api.localhost",
    ...fixedState,
  });

  response = await request
    .post("/api/logout")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
    ...fixedState,
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
    ...fixedState,
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
    ...fixedState,
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
    ...fixedState,
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
    ...fixedState,
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
    ...fixedState,
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
    ...fixedState,
  });

  response = await request
    .post("/api/logout")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
    ...fixedState,
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
    apiHost: "api.localhost",
    ...fixedState,
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
    ...fixedState,
  });
});
