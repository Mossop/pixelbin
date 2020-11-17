/* eslint-disable @typescript-eslint/naming-convention */
import type net from "net";

import { deferCall, mockedFunction } from "../../test-helpers";
import { Level } from "../../utils";
import { getTestDatabaseConfig } from "../database/test-helpers";
import { mockNextParent } from "../worker/test-helpers";
import type { ParentProcessInterface, WebserverConfig } from "./interfaces";

jest.mock("../worker/parent");
jest.mock("./app", () => jest.fn().mockName("buildApp"));
jest.mock("../cache", () => ({
  Cache: {
    connect: jest.fn(() => Promise.resolve()).mockName("Cache.connect"),
  },
}));
jest.mock("../database", () => ({
  DatabaseConnection: {
    connect: jest.fn(() => Promise.resolve()).mockName("DatabaseConnection.connect"),
  },
}));

test("init", async (): Promise<void> => {
  let config: WebserverConfig = {
    database: getTestDatabaseConfig(),
    logging: {
      default: Level.Silent,
    },
    storage: {
      tempDirectory: "nowhere",
      localDirectory: "nowhere",
    },
    cache: {
      host: "localhost",
    },
    secretKeys: ["foo"],
  };

  let parentInterface = {
    canStartTask: jest.fn<Promise<boolean>, []>(),
    handleUploadedFile: jest.fn<Promise<void>, [string]>(),
    getServer: jest.fn<Promise<net.Server>, []>(),
    getConfig: jest.fn<Promise<WebserverConfig>, []>(() => Promise.resolve(config)),
  };

  let childPromise = mockNextParent<ParentProcessInterface>(parentInterface);

  let service = {
    destroy: jest.fn(() => Promise.resolve()),
  };

  const { Cache } = await import("../cache");
  const { DatabaseConnection } = await import("../database");

  let cacheConnect = mockedFunction(Cache.connect);
  let dbConnect = mockedFunction(DatabaseConnection.connect);

  // @ts-ignore
  cacheConnect.mockResolvedValueOnce(service);
  // @ts-ignore
  dbConnect.mockResolvedValueOnce(service);

  const { default: buildApp } = await import("./app");
  let deferred = deferCall(buildApp);

  await import("./index");

  let child = await childPromise;

  await deferred.call;
  // @ts-ignore
  await deferred.resolve();

  expect(cacheConnect).toHaveBeenCalledTimes(1);
  expect(cacheConnect).toHaveBeenLastCalledWith(config.cache);
  expect(dbConnect).toHaveBeenCalledTimes(1);
  expect(dbConnect).toHaveBeenLastCalledWith("webserver", config.database);
  expect(service.destroy).not.toHaveBeenCalled();

  let destroyPromise = new Promise<void>((resolve: () => void) => {
    let count = 2;
    service.destroy.mockImplementation(() => {
      count--;
      if (count == 0) {
        resolve();
      }

      return Promise.resolve();
    });
  });

  child.kill();

  await destroyPromise;
});
