import { expect } from "../../test-helpers";
import { insertTestData, testData } from "../database/test-helpers";
import { Table } from "../database/types";
import { buildTestApp } from "./test-helpers";

const agent = buildTestApp();

beforeEach(insertTestData);

test("basic connection", async (): Promise<void> => {
  const request = agent();

  await request.get("/healthcheck")
    .expect("X-Worker-Id", String(process.pid))
    .expect("X-Response-Time", /\d+ms/)
    .expect("Content-Type", "text/plain; charset=utf-8")
    .expect(200, "Ok");
});

test("state checks", async (): Promise<void> => {
  const stateFromResponse = (body: string): unknown => {
    let scriptTag = "<script id=\"initial-state\" type=\"application/json\">";
    let pos = body.indexOf(scriptTag);
    expect(pos).toBeGreaterThan(0);
    let endPos = body.indexOf("</script>", pos);
    expect(endPos).toBeGreaterThan(pos);
    let content = body.substring(pos + scriptTag.length, endPos);

    return JSON.parse(content);
  };

  const request = agent();

  let response = await request.get("/")
    .expect("Content-Type", "text/html; charset=utf-8")
    .expect(200);

  expect(stateFromResponse(response.text)).toEqual({
    user: null,
  });

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  response = await request.get("/")
    .expect("Content-Type", "text/html; charset=utf-8")
    .expect(200);

  expect(stateFromResponse(response.text)).toEqual({
    user: {
      email: "someone1@nowhere.com",
      fullname: "Someone 1",
      created: expect.toEqualDate("2020-01-01T00:00:00.000Z"),
      verified: true,
      storage: [],
      catalogs: testData[Table.Catalog],
      albums: testData[Table.Album],
      people: testData[Table.Person],
      tags: testData[Table.Tag],
      searches: testData[Table.SavedSearch],
    },
  });
});

test("routes", async (): Promise<void> => {
  const request = agent();

  await request.get("/api/foo")
    .expect(404);

  await request.get("/static/foo")
    .expect(404);

  await request.get("/app/foo")
    .expect(404);

  await request.get("/bogus")
    .expect(200);
});
