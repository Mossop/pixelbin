import path from "path";

import { mockedFunction } from "../../test-helpers";
import { createMedia, fillMetadata } from "../database";
import { insertTestData, buildTestDB } from "../database/test-helpers";
import { StorageService } from "../storage";
import { handleUploadedFile } from "./process";
import { provideService } from "./services";

jest.mock("../storage");

buildTestDB();

beforeEach(insertTestData);

test("Process metadata", async (): Promise<void> => {
  const storageService = new StorageService({
    tempDirectory: "",
    localDirectory: "",
  });
  provideService("storage", storageService);
  const storage = (await storageService.getStorage("")).get();

  // eslint-disable-next-line @typescript-eslint/unbound-method
  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);

  getUploadedFileMock.mockResolvedValueOnce({
    name: "iptc.jpg",
    path: path.join(__dirname, "..", "..", "..", "testdata", "iptc.jpg"),
  });

  let media = await createMedia("someone1@nowhere.com", "c1", fillMetadata({
  }));

  await handleUploadedFile(media.id);

  expect(deleteUploadedFileMock).toHaveBeenCalledTimes(1);
  expect(deleteUploadedFileMock).toHaveBeenLastCalledWith(media.id);
});
