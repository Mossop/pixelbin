import { emptyMetadata } from "../../model";
import { mockedClass, waitFor, expect } from "../../test-helpers";
import type { Deferred } from "../../utils";
import { now, Level, defer } from "../../utils";
import {
  buildTestDB,
  connection,
  getTestDatabaseConfig,
  insertData,
  insertTestData,
} from "../database/test-helpers";
import { Table } from "../database/types";
import { WorkerPool } from "../worker";
import { provideService } from "./services";
import { TaskManager } from "./tasks";

jest.mock("../worker/pool", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  WorkerPool: jest.fn(),
}));

buildTestDB();
beforeEach(insertTestData);

const mockPool = mockedClass(WorkerPool);

test("updateOldMedia", async (): Promise<void> => {
  provideService("database", connection);

  let pool = {
    on: jest.fn(),
    queueLength: 0,
    shutdown: jest.fn(),
    remote: {
      reprocess: jest.fn(),
    },
  };

  // @ts-ignore
  mockPool.mockReturnValueOnce(pool);

  let tasks = new TaskManager({
    maxWorkers: 2,
    maxTasksPerWorker: 2,
    logging: {
      default: Level.Silent,
    },
    database: getTestDatabaseConfig(),
    storage: {
      tempDirectory: "",
      localDirectory: "",
    },
  });

  type Call = [string, Deferred<void>];
  let calls: Call[] = [];
  pool.remote.reprocess.mockImplementation((media: string): Promise<void> => {
    let deferred = defer();
    calls.push([media, deferred]);
    return deferred.promise;
  });

  await tasks.updateOldMedia();
  expect(calls).toHaveLength(0);

  await insertData({
    [Table.MediaInfo]: [{
      id: "media1",
      created: now(),
      deleted: false,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }, {
      id: "media2",
      created: now(),
      deleted: false,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }, {
      id: "media3",
      created: now(),
      deleted: false,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }, {
      id: "media4",
      created: now(),
      deleted: false,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }, {
      id: "media5",
      created: now(),
      deleted: false,
      catalog: "c1",
      updated: now(),
      ...emptyMetadata,
    }],
    [Table.MediaFile]: [{
      id: "original1",
      media: "media1",
      uploaded: now(),
      processVersion: 1,
      fileName: "orig1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original2",
      media: "media2",
      uploaded: now(),
      processVersion: 1,
      fileName: "orig1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original3",
      media: "media3",
      uploaded: now(),
      processVersion: 1,
      fileName: "orig1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original4",
      media: "media4",
      uploaded: now(),
      processVersion: 1,
      fileName: "orig1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }, {
      id: "original5",
      media: "media5",
      uploaded: now(),
      processVersion: 1,
      fileName: "orig1.jpg",
      fileSize: 100,
      mimetype: "image/jpeg",
      width: 100,
      height: 100,
      duration: null,
      bitRate: null,
      frameRate: null,
      ...emptyMetadata,
    }],
  });

  let done = tasks.updateOldMedia();

  await waitFor(() => calls.length > 0);

  // Make sure the synchronous part of starting tasks is done.
  await Promise.resolve();

  expect(calls).toHaveLength(2);

  calls[1][1].resolve();
  await Promise.resolve();

  expect(calls).toHaveLength(3);

  calls[0][1].resolve();
  await Promise.resolve();

  expect(calls).toHaveLength(4);

  calls[3][1].resolve();
  await Promise.resolve();

  expect(calls).toHaveLength(5);

  calls[2][1].resolve();
  await Promise.resolve();

  expect(calls).toHaveLength(5);

  calls[4][1].resolve();
  await Promise.resolve();

  expect(calls).toHaveLength(5);

  await done;

  expect(calls).toHaveLength(5);
  let media = calls.map(([media, _]: [string, unknown]): string => media);
  expect(media).toInclude([
    "media1",
    "media2",
    "media3",
    "media4",
    "media5",
  ]);
});
