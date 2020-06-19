import Koa from "koa";
import { getTestDatabaseConfig } from "pixelbin-database/build/test-helpers";
import supertest, { SuperTest, Test } from "supertest";

import buildApp from "./app";

type Lifecycle = (cb: () => void) => void;
export function buildTestApp(afterAll: Lifecycle): { app: Koa, request: SuperTest<Test> } {
  let koa = buildApp({
    staticRoot: __dirname,
    appRoot: __dirname,
    secretKeys: ["foo"],
    database: getTestDatabaseConfig(),
  });

  let server = koa.listen();

  afterAll((): void => {
    server.close();
  });

  return {
    app: koa,
    request: supertest(server),
  };
}