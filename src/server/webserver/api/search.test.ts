import type { Search } from "../../../model";
import { CSRF_HEADER, emptyMetadata, Join, Operator } from "../../../model";
import { mockDateTime, expect } from "../../../test-helpers";
import { insertTestData, connection, testData } from "../../database/test-helpers";
import { Table } from "../../database/types";
import { buildTestApp, getCsrfToken } from "../test-helpers";

const agent = buildTestApp();

beforeEach(insertTestData);

test("Media search", async (): Promise<void> => {
  let request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdDT1 = mockDateTime("2017-02-01T20:30:01Z");
  let media1 = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    title: "Media 1",
  });

  mockDateTime("2010-06-09T09:30:01Z");
  await user1Db.createMedia("c1", {
    ...emptyMetadata,
    title: "Media 2",
  });

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .post("/api/media/search")
    .send({
      catalog: "c1",
      query: {
        invert: false,
        type: "field",
        field: "title",
        modifier: null,
        operator: Operator.Equal,
        value: "Media 1",
      },
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    ...emptyMetadata,
    title: "Media 1",

    albums: [],
    tags: [],
    people: [],
  }]);
});

test("Saved searches", async (): Promise<void> => {
  let request = agent();

  let response = await request
    .post("/api/login")
    .send({
      email: "someone3@nowhere.com",
      password: "password3",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let expected = [{
    ...testData[Table.SavedSearch][0],
  }, {
    ...testData[Table.SavedSearch][3],
  }];

  expect(response.body.user.searches).toInclude(expected);

  await request
    .delete("/api/search/delete")
    .send([expected[1].id])
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect(200);

  expected.pop();

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body.user.searches).toInclude(expected);

  let newQuery: Search.CompoundQuery = {
    type: "compound",
    invert: false,
    join: Join.And,
    queries: [{
      type: "field",
      invert: false,
      field: "title",
      modifier: null,
      operator: Operator.Equal,
      value: "foo",
    }],
  };

  response = await request
    .put("/api/search/create")
    .send({
      catalog: "c2",
      search: {
        name: "My search",
        shared: true,
        query: newQuery,
      },
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    id: expect.toBeId("S", 25),
    catalog: "c2",
    name: "My search",
    shared: true,
    query: newQuery,
  });

  let newId = response.body.id;

  expected.push(response.body);

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body.user.searches).toInclude(expected);

  let newQuery2: Search.FieldQuery = {
    type: "field",
    invert: false,
    field: "title",
    modifier: null,
    operator: Operator.Equal,
    value: "foo",
  };

  response = await request
    .patch("/api/search/edit")
    .send({
      id: newId,
      search: {
        query: newQuery2,
      },
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    id: newId,
    catalog: "c2",
    name: "My search",
    shared: true,
    query: newQuery2,
  });

  expected.pop();
  expected.push(response.body);

  response = await request
    .get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body.user.searches).toInclude(expected);
});
