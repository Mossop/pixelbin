import { buildTestDB } from "pixelbin-database/build/test-helpers";

import { buildTestApp } from "./test-helpers";

buildTestDB({
  beforeAll,
  beforeEach,
  afterAll,
});
const { request } = buildTestApp(afterAll);

test("basic connection", async (): Promise<void> => {
  await request.get("/healthcheck")
    .expect("X-Worker-Id", String(process.pid))
    .expect("X-Response-Time", /\d+ms/)
    .expect("Content-Type", "text/plain; charset=utf-8")
    .expect(200, "Ok");
});
