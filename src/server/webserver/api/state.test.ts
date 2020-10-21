import { ErrorCode } from "../../../model";
import { expect, mockDateTime } from "../../../test-helpers";
import { insertTestData, testData } from "../../database/test-helpers";
import { Table } from "../../database/types";
import { buildTestApp } from "../test-helpers";

jest.mock("../../../utils/datetime");

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
      email: "someone1@nowhere.com",
      fullname: "Someone 1",
      created: expect.toEqualDate("2020-01-01T00:00:00Z"),
      verified: true,
      storage: [],
      catalogs: testData[Table.Catalog],
      albums: testData[Table.Album],
      people: testData[Table.Person],
      tags: testData[Table.Tag],
      searches: testData[Table.SavedSearch],
    },
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      email: "someone1@nowhere.com",
      fullname: "Someone 1",
      created: expect.toEqualDate("2020-01-01T00:00:00Z"),
      verified: true,
      storage: [],
      catalogs: testData[Table.Catalog],
      albums: testData[Table.Album],
      people: testData[Table.Person],
      tags: testData[Table.Tag],
      searches: testData[Table.SavedSearch],
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
    code: ErrorCode.LoginFailed,
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });
});

test("signup", async (): Promise<void> => {
  const request = agent();

  let response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });

  let created = mockDateTime("2020-04-05T11:56:01");

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
      created: expect.toEqualDate(created),
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
      searches: [],
    },
  });

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      email: "foo@bar.com",
      fullname: "Me",
      created: expect.toEqualDate(created),
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
      searches: [],
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
      created: expect.toEqualDate(created),
      verified: true,
      storage: [],
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
      searches: [],
    },
  });
});
