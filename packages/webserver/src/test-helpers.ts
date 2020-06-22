import Koa, { DefaultState } from "koa";
import { getTestDatabaseConfig } from "pixelbin-database/build/test-helpers";
import { idSorted, Obj } from "pixelbin-utils";
import { agent, SuperTest, Test } from "supertest";

import { User, Person, Tag, Album, Catalog } from "./api";
import buildApp, { AppContext, RouterContext } from "./app";

interface TestApp {
  app: Koa<DefaultState, RouterContext<AppContext>>;
  agent: () => SuperTest<Test>;
}

type Lifecycle = (cb: () => void) => void;
export function buildTestApp(afterAll: Lifecycle): TestApp {
  let koa = buildApp({
    staticRoot: __dirname,
    appRoot: __dirname,
    secretKeys: ["foo"],
    database: getTestDatabaseConfig(),
    logConfig: {
      default: "silent",
    },
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

export function catalogs(catalogs: string | string[], items: Catalog[]): Catalog[] {
  if (!Array.isArray(catalogs)) {
    catalogs = [catalogs];
  }

  return items.filter((catalog: Catalog): boolean => catalogs.includes(catalog.id));
}

export function fromCatalogs<T extends Person | Tag | Album>(
  catalogs: string | string[],
  items: T[],
): T[] {
  if (!Array.isArray(catalogs)) {
    catalogs = [catalogs];
  }

  return items.filter((item: T): boolean => catalogs.includes(item.catalog));
}

export function expectUserState(received: Obj, state: User | null): void {
  if (!state) {
    expect(received).toEqual({ user: null });
    return;
  }

  expect(received).toEqual({
    user: expect.anything(),
  });

  let mutatedReceived = {
    ...received["user"],
  };

  let mutatedExpected = {
    ...state,
  };

  for (let arr of ["catalogs", "albums", "people", "tags"]) {
    if (arr in mutatedReceived) {
      mutatedReceived[arr] = idSorted(mutatedReceived[arr]);
    }

    if (arr in mutatedExpected) {
      mutatedExpected[arr] = idSorted(mutatedExpected[arr]);
    } else {
      mutatedExpected[arr] = [];
    }
  }

  expect(mutatedReceived).toEqual(mutatedExpected);
}
