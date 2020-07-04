import { buildTestDB } from "../database/test-helpers";
import { buildTestApp } from "./test-helpers";

buildTestDB();
const agent = buildTestApp();

test("basic connection", async (): Promise<void> => {
  const request = agent();

  await request.get("/healthcheck")
    .expect("X-Worker-Id", String(process.pid))
    .expect("X-Response-Time", /\d+ms/)
    .expect("Content-Type", "text/plain; charset=utf-8")
    .expect(200, "Ok");
});
