import { promises as fs } from "fs";
import path from "path";

import sharp from "sharp";

import type { Api } from "../../../model";
import {
  AlternateFileType,
  emptyMetadata,
  ErrorCode,
  RelationType,
  Operator,
} from "../../../model";
import { expect, mockedFunction, deferCall, mockDateTime, reordered } from "../../../test-helpers";
import { now, parseDateTime } from "../../../utils";
import { connection, insertTestData } from "../../database/test-helpers";
import type { OriginalInfo } from "../../database/unsafe";
import { StorageService } from "../../storage";
import { buildTestApp } from "../test-helpers";

jest.mock("../../storage");
jest.mock("../../../utils/datetime");

let parent = {
  canStartTask: jest.fn<Promise<boolean>, []>(() => Promise.resolve(true)),
  handleUploadedFile: jest.fn<Promise<void>, [string]>(
    (): Promise<void> => Promise.resolve(),
  ),
};
const agent = buildTestApp(parent);

beforeEach(insertTestData);

test("Media upload", async (): Promise<void> => {
  let request = agent();
  let storageService = new StorageService({
    tempDirectory: "",
    localDirectory: "",
  }, await connection);
  let storage = (await storageService.getStorage("")).get();

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
    code: ErrorCode.NotLoggedIn,
  });

  await request
    .post("/api/login")
    .send({
      email: "someone2@nowhere.com",
      password: "password2",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let createdDT = mockDateTime("2016-01-01T23:35:01");

  let copyCall = deferCall(copyUploadedFileMock);
  let handleCall = deferCall(parent.handleUploadedFile);

  let responsePromise = request
    .put("/api/media/create")
    .field("catalog", "c1")
    .field("albums[0]", "a1")
    .field("tags[0]", "t1")
    .field("tags[1]", "t2")
    .field("people[0]", "p1")
    .field("taken", "2020-04-05T17:01:04-07:00")
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

  await copyCall.resolve();

  let [newId] = await handleCall.call;
  let user2Db = (await connection).forUser("someone2@nowhere.com");
  let inDb = await user2Db.getMedia([newId]);
  expect(inDb).toHaveLength(1);
  expect(inDb[0]).toBeTruthy();
  await handleCall.resolve();

  response = await responsePromise;

  expect(response.body).toEqual({
    ...emptyMetadata,
    id: expect.stringMatching(/M:[a-zA-Z0-9]+/),
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(createdDT),
    taken: "2020-04-05T17:01:04.000-07:00",
    takenZone: "-07:00",
    catalog: "c1",
    albums: [{
      catalog: "c1",
      id: "a1",
      name: "Album 1",
      parent: null,
    }],
    people: [{
      catalog: "c1",
      id: "p1",
      name: "Person 1",
      location: null,
    }],
    tags: [{
      catalog: "c1",
      id: "t1",
      name: "tag1",
      parent: null,
    }, {
      catalog: "c1",
      id: "t2",
      name: "tag2",
      parent: null,
    }],
  });

  expect(parent.handleUploadedFile).toHaveBeenCalledTimes(1);
  expect(parent.handleUploadedFile).toHaveBeenLastCalledWith(response.body.id);

  expect(getStorageMock).toHaveBeenCalledTimes(1);
  expect(getStorageMock).toHaveBeenLastCalledWith("c1");

  expect(getUploadedFileMock).not.toHaveBeenCalled();
  expect(deleteUploadedFileMock).not.toHaveBeenCalled();

  expect(copyUploadedFileMock).toHaveBeenCalledTimes(1);

  await expect(fs.stat(path)).rejects.toThrowError("no such file or directory");

  response = await request
    .put("/api/media/create")
    .field("catalog", "c1")
    .field("tags[0][0]", "tag1")
    .field("tags[0][1]", "newtag")
    .field("tags[1][0]", "tag2")
    .field("people[0].id", "p1")
    .field("people[1].name", "Person 2")
    .field("people[2].name", "New person")
    .field("people[2].location.left", "0")
    .field("people[2].location.right", "1")
    .field("people[2].location.top", "0")
    .field("people[2].location.bottom", "1")
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(reordered(response.body)).toEqual({
    ...emptyMetadata,
    id: expect.stringMatching(/M:[a-zA-Z0-9]+/),
    created: expect.anything(),
    updated: expect.toEqualDate(response.body.created),
    catalog: "c1",
    albums: [],
    people: [{
      catalog: "c1",
      id: expect.stringMatching(/P:[a-zA-Z0-9]+/),
      name: "New person",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }, {
      catalog: "c1",
      id: "p1",
      name: "Person 1",
      location: null,
    }, {
      catalog: "c1",
      id: "p2",
      name: "Person 2",
      location: null,
    }],
    tags: [{
      catalog: "c1",
      id: expect.stringMatching(/T:[a-zA-Z0-9]+/),
      name: "newtag",
      parent: "t1",
    }, {
      catalog: "c1",
      id: "t2",
      name: "tag2",
      parent: null,
    }],
  });
});

test("Media edit", async (): Promise<void> => {
  let request = agent();
  let dbConnection = await connection;
  let user1Db = dbConnection.forUser("someone1@nowhere.com");
  let storageService = new StorageService({
    tempDirectory: "",
    localDirectory: "",
  }, dbConnection);
  let storage = (await storageService.getStorage("")).get();

  /* eslint-disable @typescript-eslint/unbound-method */
  let getStorageMock = mockedFunction(storageService.getStorage);
  getStorageMock.mockClear();

  let getUploadedFileMock = mockedFunction(storage.getUploadedFile);
  let deleteUploadedFileMock = mockedFunction(storage.deleteUploadedFile);
  let copyUploadedFileMock = mockedFunction(storage.copyUploadedFile);
  /* eslint-enable @typescript-eslint/unbound-method */

  let newMedia: Api.Media | null = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    title: "My title",
  });

  await user1Db.addMediaRelations(RelationType.Album, [newMedia.id], ["a1"]);
  await user1Db.addMediaRelations(RelationType.Tag, [newMedia.id], ["t1"]);
  await user1Db.setPersonLocations([{
    media: newMedia.id,
    person: "p1",
    location: {
      left: 0,
      right: 1,
      top: 0,
      bottom: 1,
    },
  }, {
    media: newMedia.id,
    person: "p2",
  }]);

  [newMedia] = await user1Db.getMedia([newMedia.id]);

  expect(newMedia).toEqual({
    ...emptyMetadata,
    id: expect.stringMatching(/^M:[a-zA-Z0-9]+/),
    catalog: "c1",
    created: expect.anything(),
    updated: expect.toEqualDate(newMedia?.created ?? ""),

    title: "My title",

    albums: [{
      catalog: "c1",
      id: "a1",
      name: "Album 1",
      parent: null,
    }],
    tags: [{
      catalog: "c1",
      id: "t1",
      name: "tag1",
      parent: null,
    }],
    people: [{
      catalog: "c1",
      id: "p1",
      name: "Person 1",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }, {
      catalog: "c1",
      id: "p2",
      name: "Person 2",
      location: null,
    }],
  });

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let updatedDT = mockDateTime("2020-03-04T05:06:07Z");

  let response = await request
    .patch("/api/media/edit")
    .send({
      id: newMedia?.id,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    ...emptyMetadata,
    id: newMedia?.id,
    catalog: "c1",
    created: expect.toEqualDate(newMedia?.created ?? ""),
    updated: expect.toEqualDate(updatedDT),

    title: "My title",

    albums: [{
      catalog: "c1",
      id: "a1",
      name: "Album 1",
      parent: null,
    }],
    tags: [{
      catalog: "c1",
      id: "t1",
      name: "tag1",
      parent: null,
    }],
    people: [{
      catalog: "c1",
      id: "p1",
      name: "Person 1",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }, {
      catalog: "c1",
      id: "p2",
      name: "Person 2",
      location: null,
    }],
  });

  expect(getStorageMock).not.toHaveBeenCalled();
  expect(copyUploadedFileMock).not.toHaveBeenCalled();
  expect(getUploadedFileMock).not.toHaveBeenCalled();
  expect(deleteUploadedFileMock).not.toHaveBeenCalled();
  expect(parent.handleUploadedFile).not.toHaveBeenCalled();

  updatedDT = mockDateTime("2020-03-05T05:06:07Z");

  response = await request
    .patch("/api/media/edit")
    .send({
      id: newMedia?.id,
      title: "New title",
      taken: "2020-04-05T17:01:04-09:00",
      albums: ["a2"],
      tags: [
        "t2",
        ["tag1", "new tag"],
      ],
      people: ["p1"],
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    ...emptyMetadata,
    id: newMedia?.id,
    catalog: "c1",
    created: expect.toEqualDate(newMedia?.created ?? ""),
    updated: expect.toEqualDate(updatedDT),

    title: "New title",
    taken: "2020-04-05T17:01:04.000-09:00",
    takenZone: "-09:00",

    albums: [{
      catalog: "c1",
      id: "a2",
      name: "Album 2",
      parent: null,
    }],
    tags: [{
      catalog: "c1",
      id: "t2",
      name: "tag2",
      parent: null,
    }, {
      catalog: "c1",
      id: expect.stringMatching(/^T:[a-zA-Z0-9]+/),
      name: "new tag",
      parent: "t1",
    }],
    people: [{
      catalog: "c1",
      id: "p1",
      name: "Person 1",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  });

  expect(getStorageMock).not.toHaveBeenCalled();
  expect(copyUploadedFileMock).not.toHaveBeenCalled();
  expect(getUploadedFileMock).not.toHaveBeenCalled();
  expect(deleteUploadedFileMock).not.toHaveBeenCalled();
  expect(parent.handleUploadedFile).not.toHaveBeenCalled();

  updatedDT = mockDateTime("2020-03-06T05:06:07Z");

  response = await request
    .patch("/api/media/edit")
    .send({
      id: newMedia?.id,
      city: "Portland",
      albums: [],
      people: [],
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    ...emptyMetadata,
    id: newMedia?.id,
    catalog: "c1",
    created: expect.toEqualDate(newMedia?.created ?? ""),
    updated: expect.toEqualDate(updatedDT),

    title: "New title",
    city: "Portland",
    taken: "2020-04-05T17:01:04.000-09:00",
    takenZone: "-09:00",

    albums: [],
    tags: [{
      catalog: "c1",
      id: "t2",
      name: "tag2",
      parent: null,
    }, {
      catalog: "c1",
      id: expect.stringMatching(/^T:[a-zA-Z0-9]+/),
      name: "new tag",
      parent: "t1",
    }],
    people: [],
  });

  expect(getStorageMock).not.toHaveBeenCalled();
  expect(copyUploadedFileMock).not.toHaveBeenCalled();
  expect(getUploadedFileMock).not.toHaveBeenCalled();
  expect(deleteUploadedFileMock).not.toHaveBeenCalled();
  expect(parent.handleUploadedFile).not.toHaveBeenCalled();

  let copyCall = deferCall(copyUploadedFileMock);
  let handleCall = deferCall(parent.handleUploadedFile);

  updatedDT = mockDateTime("2020-03-08T05:06:07Z");

  let responsePromise = request
    .patch("/api/media/edit")
    .field("id", newMedia?.id ?? "")
    .field("city", "London")
    .field("albums[0]", "a1")
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .expect("Content-Type", "application/json")
    .expect(200)
    .then();

  let args = await copyCall.call;
  expect(args).toHaveLength(3);
  expect(args[0]).toBe(newMedia?.id);
  expect(args[2]).toBe("myfile.jpg");

  let path = args[1];
  let stats = await fs.stat(path);
  expect(stats.isFile()).toBeTruthy();

  let contents = await fs.readFile(path, {
    encoding: "utf8",
  });

  expect(contents).toBe("my file contents");

  await copyCall.resolve();

  let [newId] = await handleCall.call;
  expect(newId).toBe(newMedia?.id);
  let inDb = await user1Db.getMedia([newId]);
  expect(inDb).toHaveLength(1);
  expect(inDb[0]).toBeTruthy();
  await handleCall.resolve();

  response = await responsePromise;

  expect(response.body).toEqual({
    ...emptyMetadata,
    id: newMedia?.id,
    catalog: "c1",
    created: expect.toEqualDate(newMedia?.created ?? ""),
    updated: expect.toEqualDate(updatedDT),

    title: "New title",
    city: "London",
    taken: "2020-04-05T17:01:04.000-09:00",
    takenZone: "-09:00",

    albums: [{
      catalog: "c1",
      id: "a1",
      parent: null,
      name: "Album 1",
    }],
    tags: [{
      catalog: "c1",
      id: "t2",
      name: "tag2",
      parent: null,
    }, {
      catalog: "c1",
      id: expect.stringMatching(/^T:[a-zA-Z0-9]+/),
      name: "new tag",
      parent: "t1",
    }],
    people: [],
  });

  expect(parent.handleUploadedFile).toHaveBeenCalledTimes(1);
  expect(parent.handleUploadedFile).toHaveBeenLastCalledWith(newMedia?.id);

  expect(getStorageMock).toHaveBeenCalledTimes(1);
  expect(getStorageMock).toHaveBeenLastCalledWith("c1");

  expect(getUploadedFileMock).not.toHaveBeenCalled();
  expect(deleteUploadedFileMock).not.toHaveBeenCalled();

  expect(copyUploadedFileMock).toHaveBeenCalledTimes(1);

  await expect(fs.stat(path)).rejects.toThrowError("no such file or directory");

  await request
    .post("/api/login")
    .send({
      email: "someone3@nowhere.com",
      password: "password3",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  await request
    .patch("/api/media/edit")
    .send({
      id: newMedia?.id,
    })
    .expect("Content-Type", "application/json")
    .expect(404);

  await request
    .patch("/api/media/edit")
    .send({
      id: "foo",
    })
    .expect("Content-Type", "application/json")
    .expect(404);
});

test("Media resources", async (): Promise<void> => {
  let request = agent();
  let storageService = new StorageService({
    tempDirectory: "",
    localDirectory: "",
  }, await connection);
  let storage = (await storageService.getStorage("")).get();

  /* eslint-disable @typescript-eslint/unbound-method */
  let getLocalFilePath = mockedFunction(storage.getLocalFilePath);
  let getFileUrl = mockedFunction(storage.getFileUrl);
  /* eslint-enable @typescript-eslint/unbound-method */

  let testfile = path.join(
    path.dirname(path.dirname(path.dirname(path.dirname(__dirname)))),
    "testdata",
    "lamppost.jpg",
  );

  getLocalFilePath.mockImplementation(() => Promise.resolve(testfile));

  let db = await connection;

  let user1Db = db.forUser("someone1@nowhere.com");

  let media = await user1Db.createMedia("c1", emptyMetadata);

  let original = await db.withNewOriginal(
    media.id,
    {
      ...emptyMetadata,
      uploaded: now(),
      processVersion: 2,
      fileName: "foo.jpg",
      fileSize: 0,
      mimetype: "image/jpeg",
      width: 800,
      height: 800,
      duration: null,
      bitRate: null,
      frameRate: null,
    },
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
    .get(`/media/thumbnail/${media.id}/${original.id}/200`)
    .expect("Content-Type", "image/jpeg")
    .expect(200);

  expect(getLocalFilePath).toHaveBeenCalledTimes(1);
  expect(getLocalFilePath).toHaveBeenLastCalledWith(media.id, original.id, "thumb1.jpg");
  getLocalFilePath.mockClear();

  getFileUrl.mockImplementationOnce(
    () => Promise.resolve(`http://original.foo/${media.id}/${original.id}`),
  );
  await request
    .get(`/media/original/${media.id}/${original.id}`)
    .expect("Location", `http://original.foo/${media.id}/${original.id}`)
    .expect(302);

  expect(getLocalFilePath).not.toHaveBeenCalled();
  expect(getFileUrl).toHaveBeenCalledTimes(1);
  expect(getFileUrl).toHaveBeenLastCalledWith(media.id, original.id, "foo.jpg");
  getFileUrl.mockClear();

  await request
    .get(`/media/poster/${media.id}/${original.id}`)
    .expect(404);

  await db.addAlternateFile(original.id, {
    type: AlternateFileType.Poster,
    fileName: "poster.jpg",
    fileSize: 0,
    mimetype: "image/jpeg",
    width: 400,
    height: 400,
    duration: null,
    bitRate: null,
    frameRate: null,
  });

  getFileUrl.mockImplementationOnce(
    () => Promise.resolve(`http://poster.foo/${media.id}/${original.id}`),
  );
  await request
    .get(`/media/poster/${media.id}/${original.id}`)
    .expect("Location", `http://poster.foo/${media.id}/${original.id}`)
    .expect(302);

  expect(getLocalFilePath).not.toHaveBeenCalled();
  expect(getFileUrl).toHaveBeenCalledTimes(1);
  expect(getFileUrl).toHaveBeenLastCalledWith(media.id, original.id, "poster.jpg");
  getFileUrl.mockClear();

  await request
    .get("/media/thumbnail/foo/bar/200")
    .expect(404);

  await request
    .get("/media/poster/foo/bar")
    .expect(404);

  await request
    .get("/media/original/foo/bar")
    .expect(404);

  let response = await request
    .get(`/media/thumbnail/${media.id}/${original.id}/150`)
    .expect("Content-Type", "image/jpeg")
    .expect(200);

  expect(getLocalFilePath).toHaveBeenCalledTimes(1);
  expect(getLocalFilePath).toHaveBeenLastCalledWith(media.id, original.id, "thumb2.jpg");
  getLocalFilePath.mockClear();

  let image = sharp(response.body);
  let metadata = await image.metadata();
  expect(metadata.width).toBe(150);
  expect(metadata.format).toBe("jpeg");

  expect(await sharp(response.body).png().toBuffer()).toMatchImageSnapshot({
    customSnapshotIdentifier: "media-thumb-150",
  });

  response = await request
    .get(`/media/thumbnail/${media.id}/${original.id}`)
    .expect("Content-Type", "image/jpeg")
    .expect(200);

  expect(getLocalFilePath).toHaveBeenCalledTimes(1);
  expect(getLocalFilePath).toHaveBeenLastCalledWith(media.id, original.id, "thumb2.jpg");
  getLocalFilePath.mockClear();

  image = sharp(response.body);
  metadata = await image.metadata();
  expect(metadata.width).toBe(150);
  expect(metadata.format).toBe("jpeg");

  expect(await sharp(response.body).png().toBuffer()).toMatchImageSnapshot({
    customSnapshotIdentifier: "media-thumb-150",
  });

  response = await request
    .get(`/media/thumbnail/${media.id}/${original.id}/200`)
    .expect("Content-Type", "image/jpeg")
    .expect(200);

  expect(getLocalFilePath).toHaveBeenCalledTimes(1);
  expect(getLocalFilePath).toHaveBeenLastCalledWith(media.id, original.id, "thumb1.jpg");
  getLocalFilePath.mockClear();

  image = sharp(response.body);
  metadata = await image.metadata();
  expect(metadata.width).toBe(200);
  expect(metadata.format).toBe("jpeg");

  expect(await sharp(response.body).png().toBuffer()).toMatchImageSnapshot({
    customSnapshotIdentifier: "media-thumb-200",
  });

  response = await request
    .get(`/media/thumbnail/${media.id}/other/200`)
    .expect("Location", `/media/thumbnail/${media.id}/${original.id}/200`)
    .expect(301);

  response = await request
    .get(`/media/thumbnail/${media.id}/other`)
    .expect("Location", `/media/thumbnail/${media.id}/${original.id}`)
    .expect(301);

  response = await request
    .get(`/media/original/${media.id}/other`)
    .expect("Location", `/media/original/${media.id}/${original.id}`)
    .expect(301);

  response = await request
    .get(`/media/poster/${media.id}/other`)
    .expect("Location", `/media/poster/${media.id}/${original.id}`)
    .expect(301);
});

test("Get media", async (): Promise<void> => {
  let request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdDT1 = mockDateTime("2017-02-01T20:30:01");
  let { id: id1 } = await user1Db.createMedia("c1", emptyMetadata);

  let createdDT2 = mockDateTime("2010-06-09T09:30:01");
  let { id: id2 } = await user1Db.createMedia("c1", emptyMetadata);
  let updatedDT2 = parseDateTime("2020-02-02T08:00:00");
  let originalId = await db.withNewOriginal(id2, {
    ...emptyMetadata,
    processVersion: 1,
    fileName: "stored.jpg",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "video/mp4",
    duration: 0,
    frameRate: 0,
    bitRate: 0,
    uploaded: updatedDT2,
  }, async (_: unknown, original: OriginalInfo): Promise<string> => original.id);

  await db.addAlternateFile(originalId, {
    type: AlternateFileType.Poster,
    fileName: "poster.jpg",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "image/jpg",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  await db.addAlternateFile(originalId, {
    type: AlternateFileType.Thumbnail,
    fileName: "thumb1.jpg",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "image/jpg",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  await db.addAlternateFile(originalId, {
    type: AlternateFileType.Thumbnail,
    fileName: "thumb2.jpg",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "image/jpg",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  await db.addAlternateFile(originalId, {
    type: AlternateFileType.Reencode,
    fileName: "enc1.mp4",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "video/mp4",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  await db.addAlternateFile(originalId, {
    type: AlternateFileType.Reencode,
    fileName: "enc2.ogg",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "video/ogg",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .get("/api/media/get")
    .query({
      id: id1,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    ...emptyMetadata,
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    albums: [],
    tags: [],
    people: [],
  }]);

  response = await request
    .get("/api/media/get")
    .query({
      id: id2,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    ...emptyMetadata,
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(updatedDT2),
    thumbnailUrl: `/media/thumbnail/${id2}/${originalId}`,
    originalUrl: `/media/original/${id2}/${originalId}`,
    posterUrl: `/media/poster/${id2}/${originalId}`,

    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "video/mp4",
    duration: 0,
    frameRate: 0,
    bitRate: 0,
    uploaded: expect.toEqualDate("2020-02-02T08:00:00Z"),

    albums: [],
    tags: [],
    people: [],
  }]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    ...emptyMetadata,
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(updatedDT2),
    thumbnailUrl: `/media/thumbnail/${id2}/${originalId}`,
    originalUrl: `/media/original/${id2}/${originalId}`,
    posterUrl: `/media/poster/${id2}/${originalId}`,

    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "video/mp4",
    duration: 0,
    frameRate: 0,
    bitRate: 0,
    uploaded: expect.toEqualDate("2020-02-02T08:00:00Z"),

    albums: [],
    tags: [],
    people: [],
  }]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id2},${id1}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    ...emptyMetadata,
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(updatedDT2),
    thumbnailUrl: `/media/thumbnail/${id2}/${originalId}`,
    originalUrl: `/media/original/${id2}/${originalId}`,
    posterUrl: `/media/poster/${id2}/${originalId}`,

    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "video/mp4",
    duration: 0,
    frameRate: 0,
    bitRate: 0,
    uploaded: expect.toEqualDate("2020-02-02T08:00:00Z"),

    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    albums: [],
    tags: [],
    people: [],
  }]);

  await request
    .delete("/api/media/delete")
    .send([id2, id1])
    .expect(200);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id2},${id1}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    null,
    null,
  ]);
});

test("Media relations", async (): Promise<void> => {
  let request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdDT1 = mockDateTime("2017-02-01T20:30:01");
  let { id: id1 } = await user1Db.createMedia("c1", emptyMetadata);

  let createdDT2 = mockDateTime("2010-06-09T09:30:01");
  let { id: id2 } = await user1Db.createMedia("c1", emptyMetadata);

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let media1 = {
    ...emptyMetadata,
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    albums: [] as Api.Album[],
    tags: [] as Api.Tag[],
    people: [] as Api.Person[],
  };

  let media2 = {
    ...emptyMetadata,
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),

    albums: [] as Api.Album[],
    tags: [] as Api.Tag[],
    people: [] as Api.Person[],
  };

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([])
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "add",
      type: "tag",
      media: [id1],
      items: ["t1"],
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    catalog: "c1",
    id: "t1",
    name: "tag1",
    parent: null,
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "add",
      type: "tag",
      media: [id1],
      items: ["t2"],
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    catalog: "c1",
    id: "t1",
    name: "tag1",
    parent: null,
  }, {
    catalog: "c1",
    id: "t2",
    name: "tag2",
    parent: null,
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "delete",
      type: "tag",
      media: [id1],
      items: ["t1"],
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    catalog: "c1",
    id: "t2",
    name: "tag2",
    parent: null,
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "setRelations",
      type: "tag",
      media: [id1],
      items: ["t1"],
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    catalog: "c1",
    id: "t1",
    name: "tag1",
    parent: null,
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "add",
      type: "tag",
      media: [id1],
      items: ["t2"],
    }, {
      operation: "delete",
      type: "tag",
      media: [id1],
      items: ["t1"],
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    catalog: "c1",
    id: "t2",
    name: "tag2",
    parent: null,
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "add",
      type: "tag",
      media: [id1],
      items: ["t1"],
    }, {
      operation: "add",
      type: "tag",
      media: [id1],
      items: ["t5"],
    }])
    .expect("Content-Type", "application/json")
    .expect(400);

  expect(response.body).toEqual({
    code: "invalid-data",
    data: {
      message: "Error: addMediaRelations items should all be in the same catalog.",
    },
  });

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "setMedia",
      type: "tag",
      media: [id2],
      items: ["t2"],
    }, {
      operation: "setMedia",
      type: "tag",
      media: [id1],
      items: ["t1"],
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    catalog: "c1",
    id: "t1",
    name: "tag1",
    parent: null,
  }];
  media2.tags = [{
    catalog: "c1",
    id: "t2",
    name: "tag2",
    parent: null,
  }];

  expect(response.body).toInclude([
    media1,
    media2,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  await request
    .patch("/api/media/relations")
    .send([{
      operation: "add",
      type: "album",
      media: ["foobar"],
      items: ["a1"],
    }])
    .expect("Content-Type", "application/json")
    .expect(404);

  await request
    .patch("/api/media/relations")
    .send([{
      operation: "add",
      type: "album",
      media: [id1],
      items: ["foobar"],
    }])
    .expect("Content-Type", "application/json")
    .expect(404);
});

test("Media person locations", async (): Promise<void> => {
  let request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdDT1 = mockDateTime("2017-02-01T20:30:01");
  let media1 = await user1Db.createMedia("c1", emptyMetadata);

  let createdDT2 = mockDateTime("2010-06-09T09:30:01");
  let media2 = await user1Db.createMedia("c1", emptyMetadata);

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .get("/api/media/get")
    .query({
      id: `${media1.id},${media2.id}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [],
  }, {
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [],
  }]);

  response = await request
    .patch("/api/media/people")
    .send([{
      media: media1.id,
      person: "p1",
      location: null,
    }, {
      media: media2.id,
      person: "p1",
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toInclude([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }],
  }]);

  response = await request
    .patch("/api/media/people")
    .send([{
      media: media1.id,
      person: "p1",
      location: {
        left: 0.5,
        right: 1,
        top: 0.5,
        bottom: 1,
      },
    }, {
      media: media2.id,
      person: "p2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toInclude([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: {
        left: 0.5,
        right: 1,
        top: 0.5,
        bottom: 1,
      },
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: null,
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
  }]);

  response = await request
    .patch("/api/media/people")
    .send([{
      media: media2.id,
      person: "p2",
      location: {
        left: 1,
        right: 1,
        top: 1,
        bottom: 1,
      },
    }, {
      media: media2.id,
      person: "p1",
      location: {
        left: 0.5,
        right: 1,
        top: 0.5,
        bottom: 1,
      },
    }, {
      media: media2.id,
      person: "p2",
      location: null,
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toInclude([{
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: {
        left: 0.5,
        right: 1,
        top: 0.5,
        bottom: 1,
      },
    }, {
      id: "p2",
      catalog: "c1",
      name: "Person 2",
      location: null,
    }],
  }]);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "add",
      type: "person",
      media: [media2.id],
      items: ["p1"],
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  response = await request
    .patch("/api/media/relations")
    .send([{
      operation: "setRelations",
      type: "person",
      media: [media2.id],
      items: ["p1"],
    }])
    .expect("Content-Type", "application/json")
    .expect(200);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${media1.id},${media2.id}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: {
        left: 0.5,
        right: 1,
        top: 0.5,
        bottom: 1,
      },
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      id: "p1",
      catalog: "c1",
      name: "Person 1",
      location: {
        left: 0.5,
        right: 1,
        top: 0.5,
        bottom: 1,
      },
    }],
  }]);
});

test("Media search", async (): Promise<void> => {
  let request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdDT1 = mockDateTime("2017-02-01T20:30:01");
  let media1 = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    title: "Media 1",
  });

  mockDateTime("2010-06-09T09:30:01");
  await user1Db.createMedia("c1", {
    ...emptyMetadata,
    title: "Media 2",
  });

  await request
    .post("/api/login")
    .send({
      email: "someone1@nowhere.com",
      password: "password1",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  let response = await request
    .post("/api/media/search")
    .send({
      catalog: "c1",
      query: {
        invert: false,
        type: "field",
        field: "title",
        modifier: null,
        operator: Operator.Equal,
        value: "Media 1",
      },
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),

    ...emptyMetadata,
    title: "Media 1",

    albums: [],
    tags: [],
    people: [],
  }]);
});

test("server overload", async (): Promise<void> => {
  let request = agent();
  let storageService = new StorageService({
    tempDirectory: "",
    localDirectory: "",
  }, await connection);
  let storage = (await storageService.getStorage("")).get();

  /* eslint-disable @typescript-eslint/unbound-method */
  let getStorageMock = mockedFunction(storageService.getStorage);
  getStorageMock.mockClear();

  let copyUploadedFileMock = mockedFunction(storage.copyUploadedFile);
  /* eslint-enable @typescript-eslint/unbound-method */

  await request
    .post("/api/login")
    .send({
      email: "someone2@nowhere.com",
      password: "password2",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  parent.canStartTask.mockResolvedValueOnce(false);

  await request
    .put("/api/media/create")
    .field("catalog", "c1")
    .field("albums[0]", "a1")
    .field("tags[0]", "t1")
    .field("tags[1]", "t2")
    .field("people[0]", "p1")
    .field("taken", "2020-04-05T17:01:04-07:00")
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .expect("Content-Type", "application/json")
    .expect(503)
    .then();

  expect(copyUploadedFileMock).not.toHaveBeenCalled();

  let user2Db = (await connection).forUser("someone2@nowhere.com");
  let found = await user2Db.listMediaInCatalog("c1");
  expect(found).toHaveLength(0);
});
