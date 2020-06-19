import { getTestDatabaseConfig } from "pixelbin-database/build/test-helpers";
import supertest from "supertest";

import buildApp from "./app";

const server = buildApp({
  staticRoot: __dirname,
  appRoot: __dirname,
  secretKeys: ["foo"],
  database: getTestDatabaseConfig(),
}).listen();
const request = supertest(server);

afterAll((): void => {
  server.close();
});

test("basic connection", async (): Promise<void> => {
  await request.get("/healthcheck")
    .expect("X-Worker-Id", String(process.pid))
    .expect("X-Response-Time", /\d+ms/)
    .expect("Content-Type", "text/plain; charset=utf-8")
    .expect(200, "Ok");
});

test("state", async (): Promise<void> => {
  let response = await request.get("/api/state")
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    user: null,
  });
});
