import { promises as fs } from "fs";
import path from "path";

import type { Moment } from "moment-timezone";
import fetch from "node-fetch";
import { dir as tmpdir } from "tmp-promise";

import { ObjectModel } from "../../model";
import { expect, realMoment, mockMoment } from "../../test-helpers";
import { buildTestDB, connection } from "../database/test-helpers";
import { StorageService } from "./service";

jest.mock("moment-timezone", (): unknown => {
  let actualMoment = jest.requireActual("moment-timezone");
  // @ts-ignore: Mocking.
  let moment = jest.fn(actualMoment);
  // @ts-ignore: Mocking.
  moment.tz = jest.fn(actualMoment.tz);
  // @ts-ignore: Mocking.
  moment.isMoment = actualMoment.isMoment;
  return moment;
});

buildTestDB();

async function getStorageConfig(
  id: string,
): Promise<Omit<ObjectModel.Storage, "id" | "owner"> | null> {
  let storeFile = path.join(__dirname, "..", "..", "..", "testdata", "aws.json");
  let stores = JSON.parse(await fs.readFile(storeFile, { encoding: "utf8" }));

  let secretsFile = path.join(__dirname, "..", "..", "..", "secrets.json");
  try {
    await fs.stat(secretsFile);

    let secrets = JSON.parse(await fs.readFile(secretsFile, { encoding: "utf8" }));
    if (id in secrets) {
      // @ts-ignore: This is correct.
      for (let [key, value] of Object.entries(secrets[id])) {
        // @ts-ignore: This is correct.
        stores[id][key] = value;
      }
    }
  } catch (e) {
    if (`STORAGE_${id.toUpperCase()}_ACCESS_KEY_ID` in process.env) {
      stores[id].accessKeyId = process.env[`STORAGE_${id.toUpperCase()}_ACCESS_KEY_ID`];
      stores[id].secretAccessKey = process.env[`STORAGE_${id.toUpperCase()}_SECRET_ACCESS_KEY`];
    }
  }

  if (!("accessKeyId" in stores[id])) {
    return null;
  }

  return stores[id] as Omit<ObjectModel.Storage, "id" | "owner">;
}

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
    mockMoment(uploaded);
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

async function storageTest(id: string): Promise<void> {
  let config = await getStorageConfig(id);
  if (!config) {
    console.warn("Skipping test due to missing secrets.");
    return;
  }

  let db = await connection;
  await db.createUser({
    email: "test@nowhere.com",
    fullname: "Test",
    password: "Nope",
  });

  let userDb = db.forUser("test@nowhere.com");

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

    let storageConfig = await userDb.createStorage(config);
    let catalog = await userDb.createCatalog({
      name: storageConfig.name,
      storage: storageConfig.id,
    });

    let storage = await service.getStorage(catalog.id);

    await storage.get().storeFile("media", "info", "file.txt", testFile);

    let url = await storage.get().getFileUrl("media", "info", "file.txt");
    let response = await fetch(url);
    expect(await response.text()).toBe("MYDATA");

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
}

test("AWS test", async (): Promise<void> => {
  return storageTest("aws");
});

test("B2 test", async (): Promise<void> => {
  return storageTest("b2");
});

test("Minio test", async (): Promise<void> => {
  return storageTest("minio");
});
