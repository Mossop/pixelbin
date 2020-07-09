import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { StorageService } from ".";

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
    await storage.get().copyUploadedFile("storage_id", testFile, "spoecial.txt");

    await fs.unlink(testFile);

    let fileData = await storage.get().getUploadedFile("bad_storage_id");
    expect(fileData).toBeNull();

    fileData = await storage.get().getUploadedFile("storage_id");
    expect(fileData).not.toBeNull();
    expect(fileData?.name).toBe("spoecial.txt");

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let data = await fs.readFile(fileData!.path, {
      encoding: "utf8",
    });
    expect(data).toBe("MYDATA");

    await storage.get().deleteUploadedFile("storage_id");
    await storage.get().deleteUploadedFile("bad_storage_id");

    expect(await storage.get().getUploadedFile("storage_id")).toBeNull();

    let localBar = await storage.get().getLocalFilePath("foo", "bar");
    expect(localBar).toBe(path.join(local, "myid", "foo", "bar"));
    let stat = await fs.stat(path.join(local, "myid", "foo"));
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
