import supertest from "supertest";

import buildApp from "./app";

const server = buildApp({
  staticRoot: __dirname,
  appRoot: __dirname,
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
