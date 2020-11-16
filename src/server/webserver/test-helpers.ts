import type http from "http";
import net from "net";
import path from "path";

import { CookieAccessInfo } from "cookiejar";
import type { SuperTest, Test } from "supertest";
import { agent } from "supertest";

import type { Api, ApiSerialization } from "../../model";
import { CSRF_COOKIE } from "../../model";
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
        secretKeys: ["foo"],
        database: getTestDatabaseConfig(),
        logging: {
          default: "silent",
        },
        storage: storageConfig,
        cache: cacheConfig,
      };
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
  void Services.server.then((httpServer: http.Server) => httpServer.listen(server));

  return (): SuperTest<Test> => agent(server);
}

export function getCsrfToken(request: SuperTest<Test>): string {
  let token = request.jar.getCookie(CSRF_COOKIE, new CookieAccessInfo("", "/", false, true));
  return token?.value ?? "";
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
      owner,
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

export function expectUserState(json: Obj, state: ApiSerialization<Api.User> | null): void {
  if (!state) {
    expect(json).toEqual({ user: null });
    return;
  }

  expect(json).toEqual({
    user: expect.anything(),
  });

  let received = {
    ...json["user"],
  };

  let expected = {
    ...state,
    created: expect.toEqualDate(state.created),
    lastLogin: state.lastLogin ? expect.toEqualDate(state.lastLogin) : null,
  };

  for (let arr of ["catalogs", "albums", "people", "tags"]) {
    if (arr in received) {
      received[arr] = idSorted(received[arr]);
    }

    if (arr in expected) {
      expected[arr] = idSorted(expected[arr]);
    } else {
      expected[arr] = [];
    }
  }

  expect(received).toEqual(expected);
}
