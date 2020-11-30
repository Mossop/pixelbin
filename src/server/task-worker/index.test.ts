/* eslint-disable @typescript-eslint/naming-convention */
import { awaitEvent, deferCall, mockedFunction, awaitCall } from "../../test-helpers";
import { Level } from "../../utils";
import { getTestDatabaseConfig } from "../database/test-helpers";
import { mockNextParent } from "../worker/test-helpers";
import type { ParentProcessInterface, TaskWorkerConfig } from "./interfaces";

jest.mock("../worker/parent");
jest.mock("../database", () => ({
  DatabaseConnection: {
    connect: jest.fn(() => Promise.resolve()).mockName("DatabaseConnection.connect"),
  },
}));

test("init", async (): Promise<void> => {
  let config: TaskWorkerConfig = {
    database: getTestDatabaseConfig(),
    logging: {
      default: Level.Silent,
    },
    storage: {
      tempDirectory: "nowhere",
      localDirectory: "nowhere",
    },
  };

  let parentInterface = {
    getConfig: jest.fn<Promise<TaskWorkerConfig>, []>(() => Promise.resolve(config)),
  };

  let childPromise = mockNextParent<ParentProcessInterface>(parentInterface);

  let service = {
    destroy: jest.fn(() => Promise.resolve()),
  };

  const { DatabaseConnection } = await import("../database");

  let dbConnect = mockedFunction(DatabaseConnection.connect);
  // @ts-ignore
  let dbConnected = awaitCall(dbConnect, service);

  await import("./index");

  let child = await childPromise;

  await dbConnected;

  expect(dbConnect).toHaveBeenCalledTimes(1);
  expect(dbConnect).toHaveBeenLastCalledWith(config.database);
  expect(service.destroy).not.toHaveBeenCalled();

  const { default: events } = await import("./events");

  let destroyPromise = deferCall(service.destroy);
  let shutdownPromise = awaitEvent(events, "shutdown");

  child.kill();

  await shutdownPromise;
  await destroyPromise.call;
});
