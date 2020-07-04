import net from "net";
import path from "path";

import { agent, SuperTest, Test } from "supertest";

import { User, Person, Tag, Album, Catalog } from "../../model/api";
import { idSorted, Obj, Resolver, Rejecter } from "../../utils";
import { RemoteInterface } from "../../worker";
import { getTestDatabaseConfig } from "../database/test-helpers";
import buildApp from "./app";
import { ParentProcessInterface, WebserverConfig } from "./interfaces";

export function buildTestApp(
  parentInterface: Partial<RemoteInterface<ParentProcessInterface>> = {},
): (() => SuperTest<Test>) {
  let server = net.createServer();
  server.listen();

  let parent: RemoteInterface<ParentProcessInterface> = {
    async getConfig(): Promise<WebserverConfig> {
      return {
        staticRoot: __dirname,
        appRoot: __dirname,
        secretKeys: ["foo"],
        databaseConfig: getTestDatabaseConfig(),
        logConfig: {
          default: "silent",
        },
        storageConfig: {
          tempDirectory: path.join(path.basename(__dirname), "tmp", "temp"),
          localDirectory: path.join(path.basename(__dirname), "tmp", "local"),
        },
      };
    },

    async getServer(): Promise<net.Server> {
      return server;
    },

    handleUploadedFile: (): Promise<void> => Promise.resolve(),

    ...parentInterface,
  };

  afterAll((): Promise<void> => {
    return new Promise((resolve: Resolver<void>, reject: Rejecter): void => {
      server.close((err: Error | undefined): void => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });

  void buildApp(parent);
  return (): SuperTest<Test> => agent(server);
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
