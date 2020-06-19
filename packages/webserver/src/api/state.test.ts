import { initDB, resetDB, destroyDB } from "pixelbin-database/build/test-helpers";

import { buildTestApp } from "../test-helpers";

beforeAll(initDB);
beforeEach(resetDB);
afterAll(destroyDB);

const { request } = buildTestApp(afterAll);

test("state", async (): Promise<void> => {
  let response = await request.get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: {
      "email": "dtownsend@oxymoronical.com",
      "fullname": "Dave Townsend",
      "hadCatalog": false,
      "verified": true,
      "catalogs": [],
      "albums": [],
      "people": [],
      "tags": [],
    },
  });
});
