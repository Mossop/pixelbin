import { promises as fs } from "fs";

import moment, { Moment } from "moment-timezone";

import { expect, mockedFunction, deferCall } from "../../../test-helpers";
import { fillMetadata } from "../../database";
import {
  connection,
  buildTestDB,
  insertTestData,
} from "../../database/test-helpers";
import { StorageService } from "../../storage";
import { ApiErrorCode } from "../error";
import { buildTestApp } from "../test-helpers";

/* eslint-disable */
jest.mock("../../storage");
jest.mock("moment-timezone", (): unknown => {
  const actualMoment = jest.requireActual("moment-timezone");
  let moment = jest.fn(actualMoment);
  // @ts-ignore: Mocking.
  moment.tz = jest.fn(actualMoment.tz);
  // @ts-ignore: Mocking.
  moment.isMoment = actualMoment.isMoment;
  return moment;
});
/* eslint-enable */

buildTestDB();

beforeEach(insertTestData);

let parent = {
  handleUploadedFile: jest.fn<Promise<void>, [string]>((): Promise<void> => Promise.resolve()),
};
const agent = buildTestApp(parent);

const mockedMoment = mockedFunction(moment);
const realMoment: typeof moment = jest.requireActual("moment-timezone");

test("Media upload", async (): Promise<void> => {
  const request = agent();
  const storageService = new StorageService({
    tempDirectory: "",
    localDirectory: "",
  }, await connection);
  const storage = (await storageService.getStorage("")).get();

  /* eslint-disable @typescript-eslint/unbound-method */
  let getStorageMock = mockedFunction(storageService.getStorage);
  getStorageMock.mockClear();

  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);
  let copyUploadedFileMock = mockedFunction(storage.copyUploadedFile);
  /* eslint-enable @typescript-eslint/unbound-method */

  let response = await request
    .put("/api/media/create")
    .field("catalog", "c1")
    .attach("file", Buffer.from("my file"), {
      filename: "myfile.jpg",
    })
    .expect("Content-Type", "application/json")
    .expect(401);

  expect(response.body).toEqual({
    code: ApiErrorCode.NotLoggedIn,
  });

  await request
    .post("/api/login")
    .send({
      email: "someone2@nowhere.com",
      password: "password2",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let createdMoment: Moment = realMoment.tz("2016-01-01T23:35:01", "UTC");
  mockedMoment.mockImplementationOnce((): Moment => createdMoment);

  let copyCall = deferCall(copyUploadedFileMock);

  let responsePromise = request
    .put("/api/media/create")
    .field("catalog", "c1")
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .expect("Content-Type", "application/json")
    .expect(200)
    .then();

  let args = await copyCall.call;
  expect(args).toHaveLength(3);
  expect(args[0]).toMatch(/M:[a-zA-Z0-9]+/);
  expect(args[2]).toBe("myfile.jpg");

  let path = args[1];
  let stats = await fs.stat(path);
  expect(stats.isFile()).toBeTruthy();

  let contents = await fs.readFile(path, {
    encoding: "utf8",
  });

  expect(contents).toBe("my file contents");

  copyCall.resolve();

  response = await responsePromise;

  expect(response.body).toEqual(fillMetadata({
    id: expect.stringMatching(/M:[a-zA-Z0-9]+/),
    created: expect.toEqualDate(createdMoment),
    catalog: "c1",
  }));

  expect(parent.handleUploadedFile).toHaveBeenCalledTimes(1);
  expect(parent.handleUploadedFile).toHaveBeenLastCalledWith(response.body.id);

  expect(getStorageMock).toHaveBeenCalledTimes(1);
  expect(getStorageMock).toHaveBeenLastCalledWith("c1");

  expect(getUploadedFileMock).not.toHaveBeenCalled();
  expect(deleteUploadedFileMock).not.toHaveBeenCalled();

  expect(copyUploadedFileMock).toHaveBeenCalledTimes(1);

  await expect(fs.stat(path)).rejects.toThrowError("no such file or directory");
});
