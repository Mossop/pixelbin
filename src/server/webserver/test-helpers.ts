import net from "net";
import path from "path";

import type { SuperTest, Test } from "supertest";
import { agent } from "supertest";

import type { Api, ResponseFor } from "../../model";
import { expect } from "../../test-helpers";
import type { Obj, Resolver, Rejecter } from "../../utils";
import { idSorted } from "../../utils";
import type { CacheConfig } from "../cache";
import { Cache } from "../cache";
import type { DatabaseConnection } from "../database";
import { buildTestDB, connection, getTestDatabaseConfig } from "../database/test-helpers";
import type { Tables } from "../database/types";
import { StorageService } from "../storage";
import type { RemoteInterface } from "../worker";
import buildApp from "./app";
import events from "./events";
import type { ParentProcessInterface, WebserverConfig } from "./interfaces";
import Services, { provideService } from "./services";

export function buildTestApp(
  parentInterface: Partial<RemoteInterface<ParentProcessInterface>> = {},
): (() => SuperTest<Test>) {
  buildTestDB();
  provideService("database", connection);

  let storageConfig = {
    tempDirectory: path.join(path.basename(__dirname), "tmp", "temp"),
    localDirectory: path.join(path.basename(__dirname), "tmp", "local"),
  };

  void connection.then((dbConnection: DatabaseConnection): void => {
    let storage = new StorageService(storageConfig, dbConnection);
    provideService("storage", storage);
  });

  let server = net.createServer();
  server.listen();

  let cacheConfig: CacheConfig = {
    namespace: `test${process.pid}`,
    host: "localhost",
  };

  provideService("cache", Cache.connect(cacheConfig).then(async (cache: Cache): Promise<Cache> => {
    await cache.flush();
    return cache;
  }));

  let parent: RemoteInterface<ParentProcessInterface> = {
    async getConfig(): Promise<WebserverConfig> {
      return {
        htmlTemplate: path.join(__dirname, "..", "..", "..", "testdata", "index.html"),
        staticRoot: __dirname,
        appRoot: __dirname,
        secretKeys: ["foo"],
        database: getTestDatabaseConfig(),
        logging: {
          default: "silent",
        },
        storage: storageConfig,
        cache: cacheConfig,
      };
    },

    async getServer(): Promise<net.Server> {
      return server;
    },

    canStartTask: (): Promise<boolean> => Promise.resolve(true),

    handleUploadedFile: (): Promise<void> => Promise.resolve(),

    ...parentInterface,
  };

  provideService("parent", parent);

  afterAll(async (): Promise<void> => {
    events.emit("shutdown");
    await Services.cache.then(async (cache: Cache): Promise<void> => {
      await cache.flush();
      await cache.destroy();
    });
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

  void buildApp();

  return (): SuperTest<Test> => agent(server);
}

export function catalogs(catalogs: string | string[], items: Api.Catalog[]): Api.Catalog[] {
  if (!Array.isArray(catalogs)) {
    catalogs = [catalogs];
  }

  return items.filter((catalog: Api.Catalog): boolean => catalogs.includes(catalog.id));
}

export function storage(items: Tables.Storage[]): Api.Storage[] {
  return items.map((storage: Tables.Storage): Api.Storage => {
    let {
      user,
      accessKeyId,
      secretAccessKey,
      ...rest
    } = storage;
    return rest;
  });
}

export function fromCatalogs<T extends Api.Person | Api.Tag | Api.Album | Api.SavedSearch>(
  catalogs: string | string[],
  items: T[],
): T[] {
  if (!Array.isArray(catalogs)) {
    catalogs = [catalogs];
  }

  return items.filter((item: T): boolean => catalogs.includes(item.catalog));
}

export function expectUserState(received: Obj, state: ResponseFor<Api.User> | null): void {
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
    created: expect.toEqualDate(state.created),
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
