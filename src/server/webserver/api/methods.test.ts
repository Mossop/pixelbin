import { insertTestData } from "../../database/test-helpers";
import { ApiError } from "../error";
import { buildTestApp } from "../test-helpers";
import { decodeBody } from "./methods";

const agent = buildTestApp();

beforeEach(insertTestData);

test("body decode", (): void => {
  expect(decodeBody({
    a: "b",
    b: 5,
    "c[0]": 57,
    "d.c": 45,
    "e[0]": 4,
    "e[1]": 5,
    "f[0].t.g[0].f": 34,
    "f[1].t.g[0].f": 67,
    "g[0][0]": 7,
    "g[0][1]": 8,
    "g[1]": "hello",
  })).toEqual({
    a: "b",
    b: 5,
    c: [57],
    d: {
      c: 45,
    },
    e: [4, 5],
    f: [{
      t: {
        g: [{
          f: 34,
        }],
      },
    }, {
      t: {
        g: [{
          f: 67,
        }],
      },
    }],
    g: [
      [7, 8],
      "hello",
    ],
  });

  expect(() => decodeBody({
    "a.": 5,
  })).toThrow(ApiError);

  expect(() => decodeBody({
    "a": 5,
    "a.b": 6,
  })).toThrow(ApiError);

  expect(() => decodeBody({
    "a[0]": 5,
    "a.b": 6,
  })).toThrow(ApiError);
});

test("formdata decoding", async (): Promise<void> => {
  const request = agent();

  await request
    .post("/api/login")
    .field("json", JSON.stringify({
      email: "someone2@nowhere.com",
      password: "password2",
    }))
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .put("/api/catalog/create")
    .field("json", JSON.stringify({
      storage: "s1",
      name: "Good user",
    }))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    id: expect.stringMatching(/^C:[a-zA-Z0-9]+/),
    storage: "s1",
    name: "Good user",
  });
});
