import { promises as fs } from "fs";
import path from "path";

import { dir as tmpdir } from "tmp-promise";

import { mockedFunction } from "../../test-helpers";
import type { DatabaseConnection } from "../database";
import { Remote } from "./remote";
import { Storage } from "./storage";

jest.mock("./remote", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Remote: {
    getAWSRemote: jest.fn(),
  },
}));

const mockedAWSRemote = mockedFunction(Remote.getAWSRemote);

test("rollback", async (): Promise<void> => {
  let temp = await tmpdir({
    unsafeCleanup: true,
  });
  let local = await tmpdir({
    unsafeCleanup: true,
  });

  let mockRemote = {
    upload: jest.fn(() => Promise.resolve()),
    getUrl: jest.fn(() => Promise.reject("Unimplemented")),
    stream: jest.fn(() => Promise.reject("Unimplemented")),
    copy: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
  };
  mockedAWSRemote.mockResolvedValue(mockRemote);

  try {
    // Only the remote uses the DB connection and our remote is fake.
    let storage = new Storage({} as DatabaseConnection, "c1", temp.path, local.path);

    let dir1 = "";
    let dir2 = "";

    await expect(storage.inTransaction(async (storage: Storage): Promise<void> => {
      let sourceFile = path.join(temp.path, "test1");
      await fs.writeFile(sourceFile, "hello");
      await storage.storeFile("mdi", "fl", "myname", sourceFile, "text/foo");

      await fs.writeFile(sourceFile, "biglongerfile");
      await storage.storeFile("mdi", "fl2", "other", sourceFile, "image/jpeg");

      await fs.writeFile(sourceFile, "boo");
      await storage.storeFile("mdi", "fl3", "thisone", sourceFile, "video/mp4");

      await storage.copyFile("mdi", "fl1", "old", "fl2", "new");
      await storage.copyFile("mdi", "fl1", "old", "fl3", "test");

      expect(mockRemote.upload.mock.calls).toEqual([
        ["mdi/fl/myname", expect.anything(), 5, "text/foo"],
        ["mdi/fl2/other", expect.anything(), 13, "image/jpeg"],
        ["mdi/fl3/thisone", expect.anything(), 3, "video/mp4"],
      ]);
      mockRemote.upload.mockClear();

      expect(mockRemote.copy.mock.calls).toEqual([
        ["mdi/fl1/old", "mdi/fl2/new"],
        ["mdi/fl1/old", "mdi/fl3/test"],
      ]);
      mockRemote.copy.mockClear();

      let local = await storage.getLocalFilePath("md1", "mdfl", "myname");
      await expect(fs.stat(local)).rejects.toThrow();
      dir1 = path.dirname(local);
      await expect(fs.stat(dir1)).resolves.toBeTruthy();
      await fs.writeFile(local, "myfile");

      local = await storage.getLocalFilePath("md1", "mdfl", "antoehrname");
      await fs.writeFile(local, "anotherfile");

      local = await storage.getLocalFilePath("md1", "mdft", "another");
      await expect(fs.stat(local)).rejects.toThrow();
      dir2 = path.dirname(local);
      await expect(fs.stat(dir2)).resolves.toBeTruthy();
      await fs.writeFile(local, "and another");

      let lock = path.join(dir2, "foo");
      await fs.writeFile(lock, "locking this directory");

      throw new Error("Bailing out");
    })).rejects.toThrow("Bailing out");

    expect(mockRemote.delete.mock.calls).toEqual([
      ["mdi/fl/myname"],
      ["mdi/fl2/other"],
      ["mdi/fl3/thisone"],
      ["mdi/fl2/new"],
      ["mdi/fl3/test"],
    ]);
    mockRemote.delete.mockClear();

    await expect(fs.stat(dir1)).rejects.toThrow();
    await expect(fs.stat(dir2)).resolves.toBeTruthy();
    let lock = path.join(dir2, "another");
    await expect(fs.stat(lock)).rejects.toThrow();
  } finally {
    await temp.cleanup();
    await local.cleanup();
  }
});
