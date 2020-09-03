import moment from "moment-timezone";

import { Api } from "../../../model";
import { expect, mockedFunction } from "../../../test-helpers";
import { insertTestData, testData } from "../../database/test-helpers";
import { Table } from "../../database/types";
import { buildTestApp } from "../test-helpers";

jest.mock("moment-timezone", (): unknown => {
  const actualMoment = jest.requireActual("moment-timezone");
  let moment = jest.fn(actualMoment);
  // @ts-ignore: Mocking.
  moment.tz = jest.fn(actualMoment.tz);
  // @ts-ignore: Mocking.
  moment.isMoment = actualMoment.isMoment;
  return moment;
});

const mockedMoment = mockedFunction(moment);
const realMoment: typeof moment = jest.requireActual("moment-timezone");

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
      "created": expect.toEqualDate("2020-01-01T00:00:00Z"),
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
      "created": expect.toEqualDate("2020-01-01T00:00:00Z"),
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
    code: Api.ErrorCode.LoginFailed,
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

  let created = realMoment.tz("2020-04-05T11:56:01", "UTC");
  mockedMoment.mockReturnValueOnce(created);

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
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
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
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
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
      catalogs: [],
      albums: [],
      tags: [],
      people: [],
    },
  });
});
