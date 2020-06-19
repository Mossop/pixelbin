import Koa, { DefaultContext } from "koa";
import { getTestDatabaseConfig } from "pixelbin-database/build/test-helpers";
import { agent, SuperTest, Test } from "supertest";

import buildApp, { AppContext } from "./app";

interface TestApp {
  app: Koa<DefaultContext, AppContext>;
  agent: () => SuperTest<Test>;
}

type Lifecycle = (cb: () => void) => void;
export function buildTestApp(afterAll: Lifecycle): TestApp {
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
    agent: (): SuperTest<Test> => agent(server),
  };
}