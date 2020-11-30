import { promises as fs } from "fs";
import path from "path";

import { dir as tmpdir } from "tmp-promise";

import type { Api } from "../../../model";
import {
  CSRF_HEADER,
  AlternateFileType,
  emptyMetadata,
  ErrorCode,
  RelationType,
} from "../../../model";
import { expect, mockedFunction, deferCall, mockDateTime, reordered } from "../../../test-helpers";
import { now, parseDateTime } from "../../../utils";
import type { MediaFile, MediaView } from "../../database";
import { connection, insertTestData } from "../../database/test-helpers";
import { StorageService } from "../../storage";
import { buildTestApp, getCsrfToken } from "../test-helpers";

jest.mock("../../storage");

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
    .set(CSRF_HEADER, getCsrfToken(request))
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

  let createdDT = mockDateTime("2016-01-01T23:35:01Z");

  let copyCall = deferCall(copyUploadedFileMock);
  let handleCall = deferCall(parent.handleUploadedFile);

  let responsePromise = request
    .put("/api/media/create")
    .field("catalog", "c1")
    .field("albums[0]", "a1")
    .field("tags[0]", "t1")
    .field("tags[1]", "t2")
    .field("people[0]", "p1")
    .field("media.taken", "2020-04-05T17:01:04-07:00")
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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
    file: null,
    created: expect.toEqualDate(createdDT),
    updated: expect.toEqualDate(createdDT),
    taken: "2020-04-05T17:01:04.000-07:00",
    takenZone: "UTC-7",
    catalog: "c1",
    albums: [{
      album: "a1",
    }],
    people: [{
      person: "p1",
      location: null,
    }],
    tags: [{
      tag: "t1",
    }, {
      tag: "t2",
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
    .field("people[0].person", "p1")
    .field("people[1].name", "Person 2")
    .field("people[2].name", "New person")
    .field("people[2].location.left", "0")
    .field("people[2].location.right", "1")
    .field("people[2].location.top", "0")
    .field("people[2].location.bottom", "1")
    .field("media.taken", "2020-05-02T07:08:09")
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(reordered(response.body)).toEqual({
    ...emptyMetadata,
    id: expect.stringMatching(/M:[a-zA-Z0-9]+/),
    created: expect.anything(),
    updated: expect.toEqualDate(response.body.created),
    taken: "2020-05-02T07:08:09.000",
    takenZone: null,
    file: null,
    catalog: "c1",
    albums: [],
    people: [{
      person: expect.stringMatching(/P:[a-zA-Z0-9]+/),
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }, {
      person: "p1",
      location: null,
    }, {
      person: "p2",
      location: null,
    }],
    tags: [{
      tag: expect.stringMatching(/T:[a-zA-Z0-9]+/),
    }, {
      tag: "t2",
    }],
  });

  response = await request
    .put("/api/media/create")
    .field("json", JSON.stringify({
      catalog: "c1",
      media: {
        taken: "2020-05-02T07:08:09",
        takenZone: "America/Los_Angeles",
      },
    }))
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(reordered(response.body)).toEqual({
    ...emptyMetadata,
    id: expect.stringMatching(/M:[a-zA-Z0-9]+/),
    created: expect.anything(),
    updated: expect.toEqualDate(response.body.created),
    taken: "2020-05-02T07:08:09.000-07:00",
    takenZone: "America/Los_Angeles",
    file: null,
    catalog: "c1",
    albums: [],
    people: [],
    tags: [],
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

  let newMedia: MediaView | null = await user1Db.createMedia("c1", {
    ...emptyMetadata,
    title: "My title",
    taken: parseDateTime("2020-04-05T02:05:23Z"),
    takenZone: "UTC-7",
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
    location: null,
  }]);

  [newMedia] = await user1Db.getMedia([newMedia.id]);

  expect(newMedia).toEqual({
    ...emptyMetadata,
    id: expect.toBeId("M", 25),
    catalog: "c1",
    created: expect.anything(),
    updated: expect.toEqualDate(newMedia?.created ?? ""),
    file: null,
    taken: expect.toEqualDate("2020-04-05T02:05:23.000-07:00"),
    takenZone: "UTC-7",

    title: "My title",

    albums: [{
      album: "a1",
    }],
    tags: [{
      tag: "t1",
    }],
    people: [{
      person: "p1",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }, {
      person: "p2",
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
      media: {
        takenZone: "UTC-4",
      },
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    ...emptyMetadata,
    id: newMedia?.id,
    catalog: "c1",
    created: expect.toEqualDate(newMedia?.created ?? ""),
    updated: expect.toEqualDate(updatedDT),
    file: null,
    taken: "2020-04-05T02:05:23.000-04:00",
    takenZone: "UTC-4",

    title: "My title",

    albums: [{
      album: "a1",
    }],
    tags: [{
      tag: "t1",
    }],
    people: [{
      person: "p1",
      location: {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }, {
      person: "p2",
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
      media: {
        title: "New title",
        taken: "2020-04-05T17:01:04",
      },
      albums: ["a2"],
      tags: [
        "t2",
        ["tag1", "new tag"],
      ],
      people: ["p1"],
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    ...emptyMetadata,
    id: newMedia?.id,
    catalog: "c1",
    created: expect.toEqualDate(newMedia?.created ?? ""),
    updated: expect.toEqualDate(updatedDT),
    file: null,

    title: "New title",
    taken: "2020-04-05T17:01:04.000-04:00",
    takenZone: "UTC-4",

    albums: [{
      album: "a2",
    }],
    tags: [{
      tag: "t2",
    }, {
      tag: expect.toBeId("T"),
    }],
    people: [{
      person: "p1",
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
      media: {
        city: "Portland",
        taken: "2018-03-07T21:05:52-01:00",
      },
      albums: [],
      people: [],
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual({
    ...emptyMetadata,
    id: newMedia?.id,
    catalog: "c1",
    created: expect.toEqualDate(newMedia?.created ?? ""),
    updated: expect.toEqualDate(updatedDT),
    file: null,

    title: "New title",
    city: "Portland",
    taken: "2018-03-07T21:05:52.000-01:00",
    takenZone: "UTC-1",

    albums: [],
    tags: [{
      tag: "t2",
    }, {
      tag: expect.toBeId("T"),
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
    .field("media.city", "London")
    .field("albums[0]", "a1")
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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
    file: null,

    title: "New title",
    city: "London",
    taken: "2018-03-07T21:05:52.000-01:00",
    takenZone: "UTC-1",

    albums: [{
      album: "a1",
    }],
    tags: [{
      tag: "t2",
    }, {
      tag: expect.toBeId("T"),
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

  request = agent();

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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(404);

  await request
    .patch("/api/media/edit")
    .send({
      id: "foo",
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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

  let mediaFile = await db.withNewMediaFile(
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
    async (
      db: unknown,
      mediaFile: MediaFile,
    ) => mediaFile,
  );

  await db.addAlternateFile(mediaFile.id, {
    type: AlternateFileType.Thumbnail,
    local: true,
    fileName: "thumb1.jpg",
    fileSize: 0,
    mimetype: "image/jpeg",
    width: 200,
    height: 200,
    duration: null,
    bitRate: null,
    frameRate: null,
  });

  await db.addAlternateFile(mediaFile.id, {
    type: AlternateFileType.Thumbnail,
    local: true,
    fileName: "thumb2.jpg",
    fileSize: 0,
    mimetype: "image/jpeg",
    width: 300,
    height: 300,
    duration: null,
    bitRate: null,
    frameRate: null,
  });

  let thumb = await db.addAlternateFile(mediaFile.id, {
    type: AlternateFileType.Thumbnail,
    local: true,
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

  expect(getLocalFilePath).not.toHaveBeenCalled();

  getFileUrl.mockImplementationOnce(
    (
      media: string,
      file: string,
      filename: string,
      type?: string,
    ) => Promise.resolve(`http://original.foo/${media}/${file}/${filename}/${type}`),
  );
  await request
    .get(`/media/${media.id}/${mediaFile.id}/foo`)
    .expect("Location", `http://original.foo/${media.id}/${mediaFile.id}/foo.jpg/image/jpeg`)
    .expect(302);

  expect(getLocalFilePath).not.toHaveBeenCalled();

  await request
    .get(`/media/${media.id}/${mediaFile.id}/unknown/bar`)
    .expect(404);

  let alternate = await db.addAlternateFile(mediaFile.id, {
    type: AlternateFileType.Reencode,
    local: false,
    fileName: "alternate.jpg",
    fileSize: 0,
    mimetype: "image/jpeg",
    width: 400,
    height: 400,
    duration: null,
    bitRate: null,
    frameRate: null,
  });

  getFileUrl.mockImplementationOnce(
    (
      media: string,
      file: string,
      filename: string,
      type?: string,
    ) => Promise.resolve(`http://alternate.foo/${media}/${file}/${filename}/${type}`),
  );
  await request
    .get(`/media/${media.id}/${mediaFile.id}/${alternate.id}/file`)
    .expect("Location", `http://alternate.foo/${media.id}/${mediaFile.id}/alternate.jpg/image/jpeg`)
    .expect(302);

  expect(getLocalFilePath).not.toHaveBeenCalled();

  await request
    .get("/media/foo/bar/baz/buz")
    .expect(404);

  await request
    .get("/media/foo/bar/baz")
    .expect(404);

  let temp = await tmpdir({
    unsafeCleanup: true,
  });
  let source = path.join(temp.path, "test.txt");
  await fs.writeFile(source, "Hello");

  getFileUrl.mockClear();
  getLocalFilePath.mockResolvedValueOnce(source);
  await request
    .get(`/media/${media.id}/${mediaFile.id}/${thumb.id}/thumb.jpg`)
    .expect("Content-Type", "image/jpeg")
    .expect(200);

  expect(getFileUrl).not.toHaveBeenCalled();
  expect(getLocalFilePath).toHaveBeenCalledTimes(1);
  expect(getLocalFilePath).toHaveBeenLastCalledWith(media.id, mediaFile.id, thumb.fileName);

  await temp.cleanup();
});

test("Get media", async (): Promise<void> => {
  let request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdDT1 = mockDateTime("2017-02-01T20:30:01Z");
  let { id: id1 } = await user1Db.createMedia("c1", emptyMetadata);

  let createdDT2 = mockDateTime("2010-06-09T09:30:01Z");
  let { id: id2 } = await user1Db.createMedia("c1", emptyMetadata);
  let updatedDT2 = parseDateTime("2020-02-02T08:00:00Z");

  let { id: mediaFileId } = await db.withNewMediaFile(
    id2,
    {
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
    },
    async (
      db: unknown,
      mediaFile: MediaFile,
    ) => mediaFile,
  );

  let alternate = await db.addAlternateFile(mediaFileId, {
    type: AlternateFileType.Reencode,
    local: false,
    fileName: "alternate.jpg",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "image/jpg",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  let thumb1 = await db.addAlternateFile(mediaFileId, {
    type: AlternateFileType.Thumbnail,
    local: true,
    fileName: "thumb1.jpg",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "image/jpg",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  let thumb2 = await db.addAlternateFile(mediaFileId, {
    type: AlternateFileType.Thumbnail,
    local: true,
    fileName: "thumb2.jpg",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "image/jpg",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  let encode1 = await db.addAlternateFile(mediaFileId, {
    type: AlternateFileType.Reencode,
    local: false,
    fileName: "enc1.mp4",
    fileSize: 1,
    width: 1,
    height: 1,
    mimetype: "video/mp4",
    duration: null,
    frameRate: null,
    bitRate: null,
  });

  let encode2 = await db.addAlternateFile(mediaFileId, {
    type: AlternateFileType.Reencode,
    local: false,
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    ...emptyMetadata,
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    albums: [],
    tags: [],
    people: [],
  }]);

  response = await request
    .get("/api/media/get")
    .query({
      id: id2,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    ...emptyMetadata,
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(updatedDT2),
    file: {
      id: mediaFileId,
      originalUrl: `/media/${id2}/${mediaFileId}/stored.jpg`,

      fileSize: 1,
      width: 1,
      height: 1,
      mimetype: "video/mp4",
      duration: 0,
      frameRate: 0,
      bitRate: 0,
      uploaded: expect.toEqualDate("2020-02-02T08:00:00Z"),
      thumbnails: [{
        id: thumb1.id,
        url: `/media/${id2}/${mediaFileId}/${thumb1.id}/thumb1.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: thumb2.id,
        url: `/media/${id2}/${mediaFileId}/${thumb2.id}/thumb2.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }],
      alternatives: [{
        id: alternate.id,
        url: `/media/${id2}/${mediaFileId}/${alternate.id}/alternate.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: encode1.id,
        url: `/media/${id2}/${mediaFileId}/${encode1.id}/enc1.mp4`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "video/mp4",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: encode2.id,
        url: `/media/${id2}/${mediaFileId}/${encode2.id}/enc2.ogg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "video/ogg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }],
    },

    albums: [],
    tags: [],
    people: [],
  }]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    ...emptyMetadata,
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(updatedDT2),

    file: {
      id: mediaFileId,
      originalUrl: `/media/${id2}/${mediaFileId}/stored.jpg`,
      thumbnails: [{
        id: thumb1.id,
        url: `/media/${id2}/${mediaFileId}/${thumb1.id}/thumb1.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: thumb2.id,
        url: `/media/${id2}/${mediaFileId}/${thumb2.id}/thumb2.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }],
      alternatives: [{
        id: alternate.id,
        url: `/media/${id2}/${mediaFileId}/${alternate.id}/alternate.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: encode1.id,
        url: `/media/${id2}/${mediaFileId}/${encode1.id}/enc1.mp4`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "video/mp4",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: encode2.id,
        url: `/media/${id2}/${mediaFileId}/${encode2.id}/enc2.ogg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "video/ogg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }],

      fileSize: 1,
      width: 1,
      height: 1,
      mimetype: "video/mp4",
      duration: 0,
      frameRate: 0,
      bitRate: 0,
      uploaded: expect.toEqualDate("2020-02-02T08:00:00Z"),
    },

    albums: [],
    tags: [],
    people: [],
  }]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id2},${id1}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    ...emptyMetadata,
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(updatedDT2),

    file: {
      id: mediaFileId,
      originalUrl: `/media/${id2}/${mediaFileId}/stored.jpg`,
      thumbnails: [{
        id: thumb1.id,
        url: `/media/${id2}/${mediaFileId}/${thumb1.id}/thumb1.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: thumb2.id,
        url: `/media/${id2}/${mediaFileId}/${thumb2.id}/thumb2.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }],
      alternatives: [{
        id: alternate.id,
        url: `/media/${id2}/${mediaFileId}/${alternate.id}/alternate.jpg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "image/jpg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: encode1.id,
        url: `/media/${id2}/${mediaFileId}/${encode1.id}/enc1.mp4`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "video/mp4",
        duration: null,
        frameRate: null,
        bitRate: null,
      }, {
        id: encode2.id,
        url: `/media/${id2}/${mediaFileId}/${encode2.id}/enc2.ogg`,
        fileSize: 1,
        width: 1,
        height: 1,
        mimetype: "video/ogg",
        duration: null,
        frameRate: null,
        bitRate: null,
      }],

      fileSize: 1,
      width: 1,
      height: 1,
      mimetype: "video/mp4",
      duration: 0,
      frameRate: 0,
      bitRate: 0,
      uploaded: expect.toEqualDate("2020-02-02T08:00:00Z"),
    },

    albums: [],
    tags: [],
    people: [],
  }, {
    ...emptyMetadata,
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    albums: [],
    tags: [],
    people: [],
  }]);

  await request
    .delete("/api/media/delete")
    .send([id2, id1])
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect(200);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id2},${id1}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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

  let createdDT1 = mockDateTime("2017-02-01T20:30:01Z");
  let { id: id1 } = await user1Db.createMedia("c1", emptyMetadata);

  let createdDT2 = mockDateTime("2010-06-09T09:30:01Z");
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  let media1 = {
    ...emptyMetadata,
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    albums: [] as Api.MediaAlbum[],
    tags: [] as Api.MediaTag[],
    people: [] as Api.MediaPerson[],
  };

  let media2 = {
    ...emptyMetadata,
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),
    file: null,

    albums: [] as Api.MediaAlbum[],
    tags: [] as Api.MediaTag[],
    people: [] as Api.MediaPerson[],
  };

  expect(response.body).toEqual([
    media1,
    media2,
  ]);

  response = await request
    .patch("/api/media/relations")
    .send([])
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    tag: "t1",
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    tag: "t1",
  }, {
    tag: "t2",
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    tag: "t2",
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    tag: "t1",
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    tag: "t2",
  }];

  expect(response.body).toEqual([
    media1,
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  media1.tags = [{
    tag: "t1",
  }];
  media2.tags = [{
    tag: "t2",
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
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(404);
});

test("Media person locations", async (): Promise<void> => {
  let request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdDT1 = mockDateTime("2017-02-01T20:30:01Z");
  let media1 = await user1Db.createMedia("c1", emptyMetadata);

  let createdDT2 = mockDateTime("2010-06-09T09:30:01Z");
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [],
  }, {
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),
    file: null,

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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toInclude([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }],
  }, {
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),
    file: null,

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      person: "p1",
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toInclude([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      person: "p1",
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
    file: null,

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: null,
    }, {
      person: "p2",
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toInclude([{
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT2),
    updated: expect.toEqualDate(createdDT2),
    file: null,

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: {
        left: 0.5,
        right: 1,
        top: 0.5,
        bottom: 1,
      },
    }, {
      person: "p2",
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
    .set(CSRF_HEADER, getCsrfToken(request))
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
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${media1.id},${media2.id}`,
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([{
    id: media1.id,
    catalog: "c1",
    created: expect.toEqualDate(createdDT1),
    updated: expect.toEqualDate(createdDT1),
    file: null,

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      person: "p1",
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
    file: null,

    ...emptyMetadata,

    albums: [],
    tags: [],
    people: [{
      person: "p1",
      location: {
        left: 0.5,
        right: 1,
        top: 0.5,
        bottom: 1,
      },
    }],
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
    .field("media.taken", "2020-04-05T17:01:04-07:00")
    .attach("file", Buffer.from("my file contents"), {
      filename: "myfile.jpg",
    })
    .set(CSRF_HEADER, getCsrfToken(request))
    .expect("Content-Type", "application/json")
    .expect(503)
    .then();

  expect(copyUploadedFileMock).not.toHaveBeenCalled();

  let user2Db = (await connection).forUser("someone2@nowhere.com");
  let found = await user2Db.listMediaInCatalog("c1");
  expect(found).toHaveLength(0);
});
