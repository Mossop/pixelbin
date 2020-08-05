import { promises as fs } from "fs";
import path from "path";

import moment, { Moment } from "moment-timezone";
import { dir as tmpdir } from "tmp-promise";

import { expect, mockedFunction } from "../../test-helpers";
import { insertTestData, buildTestDB, connection } from "../database/test-helpers";
import { StorageService } from "./service";

jest.mock("moment-timezone", (): unknown => {
  const actualMoment = jest.requireActual("moment-timezone");
  let moment = jest.fn(actualMoment);
  // @ts-ignore: Mocking.
  moment.tz = jest.fn(actualMoment.tz);
  // @ts-ignore: Mocking.
  moment.isMoment = actualMoment.isMoment;
  return moment;
});

const mockedMoment = mockedFunction(moment);
const realMoment: typeof moment = jest.requireActual("moment-timezone");

buildTestDB();

test("Basic storage", async (): Promise<void> => {
  let testTemp = await tmpdir({
    unsafeCleanup: true,
  });

  let temp = await tmpdir({
    unsafeCleanup: true,
  });
  let local = await tmpdir({
    unsafeCleanup: true,
  });

  try {
    let service = new StorageService({
      tempDirectory: temp.path,
      localDirectory: local.path,
    }, await connection);

    let storage = await service.getStorage("myid");

    let testFile = path.join(testTemp.path, "test1");
    await fs.writeFile(testFile, "MYDATA");

    let uploaded: Moment = realMoment.tz("2016-01-01T23:35:01", "UTC");
    mockedMoment.mockImplementationOnce((): Moment => uploaded);
    await storage.get().copyUploadedFile("storage_id", testFile, "spoecial.txt");

    await fs.unlink(testFile);

    let fileData = await storage.get().getUploadedFile("bad_storage_id");
    expect(fileData).toBeNull();

    fileData = await storage.get().getUploadedFile("storage_id");
    expect(fileData).toEqual({
      name: "spoecial.txt",
      uploaded: expect.toEqualDate(uploaded),
      path: expect.stringMatching(new RegExp(`^${temp.path}/`)),
    });
    expect(fileData).not.toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let data = await fs.readFile(fileData!.path, {
      encoding: "utf8",
    });
    expect(data).toBe("MYDATA");

    await storage.get().deleteUploadedFile("storage_id");
    await storage.get().deleteUploadedFile("bad_storage_id");

    expect(await storage.get().getUploadedFile("storage_id")).toBeNull();

    let localBar = await storage.get().getLocalFilePath("foo", "info", "bar");
    expect(localBar).toBe(path.join(local.path, "myid", "foo", "info", "bar"));
    let stat = await fs.stat(path.join(local.path, "myid", "foo", "info"));
    expect(stat.isDirectory()).toBeTruthy();

    await storage.get().deleteLocalFiles("foo", "info");
    await expect(
      fs.stat(path.join(local.path, "myid", "foo", "info")),
    ).rejects.toThrow("no such file or directory");

    stat = await fs.stat(path.join(local.path, "myid", "foo"));
    expect(stat.isDirectory()).toBeTruthy();

    await storage.get().deleteLocalFiles("foo");
    await expect(
      fs.stat(path.join(local.path, "myid", "foo")),
    ).rejects.toThrow("no such file or directory");
  } finally {
    await testTemp.cleanup();
    await temp.cleanup();
    await local.cleanup();
  }
});

test("AWS upload", async (): Promise<void> => {
  await insertTestData();

  let testTemp = await tmpdir({
    unsafeCleanup: true,
  });

  let temp = await tmpdir({
    unsafeCleanup: true,
  });
  let local = await tmpdir({
    unsafeCleanup: true,
  });

  try {
    let service = new StorageService({
      tempDirectory: temp.path,
      localDirectory: local.path,
    }, await connection);

    let testFile = path.join(testTemp.path, "file.txt");
    await fs.writeFile(testFile, "MYDATA");

    let storage = await service.getStorage("c1");

    await storage.get().storeFile("media", "info", "file.txt", testFile);

    let url = await storage.get().getFileUrl("media", "info", "file.txt");
    expect(url).toMatch(/^http:\/\/localhost:9000\//);

    let stream = await storage.get().streamFile("media", "info", "file.txt");
    let content = await new Promise((resolve: ((content: string) => void)): void => {
      const chunks: Buffer[] = [];

      stream.on("data", (chunk: Buffer): void => {
        chunks.push(chunk);
      });

      // Send the buffer or you can put it into a var
      stream.on("end", (): void => {
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });

    expect(content).toBe("MYDATA");

    await storage.get().deleteFile("media", "info", "file.txt");
  } finally {
    await testTemp.cleanup();
    await temp.cleanup();
    await local.cleanup();
  }
});
