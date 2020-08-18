import { promises as fs } from "fs";
import path from "path";

import moment, { Moment } from "moment-timezone";

import { AlternateFileType } from "../../../model";
import { expect, mockedFunction, deferCall } from "../../../test-helpers";
import { fillMetadata } from "../../database";
import { connection, insertTestData } from "../../database/test-helpers";
import { OriginalInfo } from "../../database/unsafe";
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

let parent = {
  handleUploadedFile: jest.fn<Promise<void>, [string]>((): Promise<void> => Promise.resolve()),
};
const agent = buildTestApp(parent);

beforeEach(insertTestData);

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
    .field("albums[0]", "a1")
    .field("tags[0]", "t1")
    .field("tags[1]", "t2")
    .field("people[0]", "p1")
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
    uploaded: null,
    width: null,
    height: null,
    mimetype: null,
    bitRate: null,
    frameRate: null,
    duration: null,
    fileSize: null,
    albums: [{
      "catalog": "c1",
      "id": "a1",
      "name": "Album 1",
      "parent": null,
    }],
    people: [{
      "catalog": "c1",
      "id": "p1",
      "name": "Person 1",
    }],
    tags: [{
      "catalog": "c1",
      "id": "t1",
      "name": "tag1",
      "parent": null,
    },
    {
      "catalog": "c1",
      "id": "t2",
      "name": "tag2",
      "parent": null,
    }],
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

test("Media thumbnail", async (): Promise<void> => {
  const request = agent();
  const storageService = new StorageService({
    tempDirectory: "",
    localDirectory: "",
  }, await connection);
  const storage = (await storageService.getStorage("")).get();

  /* eslint-disable @typescript-eslint/unbound-method */
  let getLocalFilePath = mockedFunction(storage.getLocalFilePath);
  /* eslint-enable @typescript-eslint/unbound-method */

  let testfile = path.join(
    path.dirname(path.dirname(path.dirname(path.dirname(__dirname)))),
    "testdata",
    "lamppost.jpg",
  );

  getLocalFilePath.mockImplementation(() => Promise.resolve(testfile));

  let db = await connection;

  let user1Db = db.forUser("someone1@nowhere.com");

  let media = await user1Db.createMedia("c1", fillMetadata({}));

  let original = await db.withNewOriginal(
    media.id,
    fillMetadata({
      uploaded: moment(),
      processVersion: 2,
      fileName: "",
      fileSize: 0,
      mimetype: "image/jpeg",
      width: 800,
      height: 800,
      duration: null,
      bitRate: null,
      frameRate: null,
    }),
    async (db: unknown, original: OriginalInfo) => original,
  );

  await db.addAlternateFile(original.id, {
    type: AlternateFileType.Thumbnail,
    fileName: "thumb1.jpg",
    fileSize: 0,
    mimetype: "image/jpeg",
    width: 200,
    height: 200,
    duration: null,
    bitRate: null,
    frameRate: null,
  });

  await db.addAlternateFile(original.id, {
    type: AlternateFileType.Thumbnail,
    fileName: "thumb2.jpg",
    fileSize: 0,
    mimetype: "image/jpeg",
    width: 300,
    height: 300,
    duration: null,
    bitRate: null,
    frameRate: null,
  });

  await db.addAlternateFile(original.id, {
    type: AlternateFileType.Thumbnail,
    fileName: "thumb3.jpg",
    fileSize: 0,
    mimetype: "image/jpeg",
    width: 400,
    height: 400,
    duration: null,
    bitRate: null,
    frameRate: null,
  });

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  await request
    .get("/api/media/thumbnail")
    .query({
      id: media.id,
      size: 200,
    })
    .expect("Content-Type", "image/jpeg")
    .expect(200);

  expect(getLocalFilePath).toHaveBeenCalledTimes(1);
  expect(getLocalFilePath).toHaveBeenLastCalledWith(media.id, original.id, "thumb1.jpg");
  getLocalFilePath.mockClear();

  await request
    .get("/api/media/thumbnail")
    .query({
      id: "foo",
      size: 200,
    })
    .expect(404);

  await request
    .get("/api/media/thumbnail")
    .query({
      id: media.id,
      size: 150,
    })
    .expect("Content-Type", "image/jpeg")
    .expect(200);

  expect(getLocalFilePath).toHaveBeenCalledTimes(1);
  expect(getLocalFilePath).toHaveBeenLastCalledWith(media.id, original.id, "thumb2.jpg");
  getLocalFilePath.mockClear();
});
