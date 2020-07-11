import { promises as fs } from "fs";
import os from "os";
import path from "path";

import moment, { Moment } from "moment-timezone";

import { StorageService } from ".";
import { expect, mockedFunction } from "../../test-helpers";

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

test("storage", async (): Promise<void> => {
  let testTemp = await fs.mkdtemp(path.join(os.tmpdir(), "temp-"));

  let temp = await fs.mkdtemp(path.join(os.tmpdir(), "temp-"));
  let local = await fs.mkdtemp(path.join(os.tmpdir(), "local-"));

  try {
    let service = new StorageService({
      tempDirectory: temp,
      localDirectory: local,
    });

    let storage = await service.getStorage("myid");

    let testFile = path.join(testTemp, "test1");
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
      path: expect.stringMatching(new RegExp(`^${temp}/`)),
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
    expect(localBar).toBe(path.join(local, "myid", "foo", "info", "bar"));
    let stat = await fs.stat(path.join(local, "myid", "foo", "info"));
    expect(stat.isDirectory()).toBeTruthy();

    await storage.get().deleteLocalFiles("foo", "info");
    await expect(
      fs.stat(path.join(local, "myid", "foo", "info")),
    ).rejects.toThrow("no such file or directory");

    stat = await fs.stat(path.join(local, "myid", "foo"));
    expect(stat.isDirectory()).toBeTruthy();

    await storage.get().deleteLocalFiles("foo");
    await expect(
      fs.stat(path.join(local, "myid", "foo")),
    ).rejects.toThrow("no such file or directory");
  } finally {
    await fs.rmdir(testTemp, {
      recursive: true,
    });
    await fs.rmdir(temp, {
      recursive: true,
    });
    await fs.rmdir(local, {
      recursive: true,
    });
  }
});
