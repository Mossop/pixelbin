import fetch from "node-fetch";

import { expect, getStorageConfig } from "../../test-helpers";
import { buildTestDB, connection } from "../database/test-helpers";
import { StorageService } from "./service";

buildTestDB();

async function urlTest(id: string): Promise<void> {
  let config = await getStorageConfig(id);
  if (!config) {
    console.warn("Skipping test due to missing secrets.");
    return;
  }

  let db = await connection;
  await db.createUser({
    email: "test@nowhere.com",
    administrator: false,
    fullname: "Test",
    password: "Nope",
  });

  let userDb = db.forUser("test@nowhere.com");

  let service = new StorageService({
    tempDirectory: __dirname,
    localDirectory: __dirname,
  }, await connection);

  let storageConfig = await userDb.createStorage(config);
  let catalog = await userDb.createCatalog(storageConfig.id, {
    name: storageConfig.name,
  });

  let storage = await service.getStorage(catalog.id);

  let url = await storage.get().getFileUrl("media", "info", "nothing.txt");
  let response = await fetch(url, { redirect: "follow" });

  // Without the listbucket permission attempting to get a non-existent file
  // may return a 403.
  expect(response.status).toBeGreaterThanOrEqual(403);
  expect(response.status).toBeLessThanOrEqual(404);
}

test("AWS url test", async (): Promise<void> => {
  return urlTest("aws");
}, 30000);

test("B2 url test", async (): Promise<void> => {
  return urlTest("b2");
}, 30000);

test("Minio url test", async (): Promise<void> => {
  return urlTest("minio");
}, 30000);
