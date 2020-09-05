import { promises as fs } from "fs";
import path from "path";

import moment, { Moment } from "moment-timezone";
import sharp from "sharp";

import { AlternateFileType, Api, emptyMetadata } from "../../../model";
import { expect, mockedFunction, deferCall, mockMoment, realMoment } from "../../../test-helpers";
import { fillMetadata } from "../../database";
import { connection, insertTestData } from "../../database/test-helpers";
import { OriginalInfo } from "../../database/unsafe";
import { StorageService } from "../../storage";
import { buildTestApp } from "../test-helpers";

jest.mock("../../storage");
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

let parent = {
  handleUploadedFile: jest.fn<Promise<void>, [string]>((): Promise<void> => Promise.resolve()),
};
const agent = buildTestApp(parent);

beforeEach(insertTestData);

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
    code: Api.ErrorCode.NotLoggedIn,
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
  mockMoment(createdMoment);

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
      "location": null,
    }],
    tags: [{
      "catalog": "c1",
      "id": "t1",
      "name": "tag1",
      "parent": null,
    }, {
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

  expect(response.body).toEqual(fillMetadata({
    id: expect.stringMatching(/M:[a-zA-Z0-9]+/),
    created: expect.anything(),
    catalog: "c1",
    albums: [],
    people: [{
      "catalog": "c1",
      "id": "p1",
      "name": "Person 1",
      "location": null,
    }, {
      "catalog": "c1",
      "id": "p2",
      "name": "Person 2",
      "location": null,
    }, {
      "catalog": "c1",
      "id": expect.stringMatching(/P:[a-zA-Z0-9]+/),
      "name": "New person",
      "location": {
        left: 0,
        right: 1,
        top: 0,
        bottom: 1,
      },
    }],
    tags: [{
      "catalog": "c1",
      "id": expect.stringMatching(/T:[a-zA-Z0-9]+/),
      "name": "newtag",
      "parent": "t1",
    }, {
      "catalog": "c1",
      "id": "t2",
      "name": "tag2",
      "parent": null,
    }],
  }));
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

  let response = await request
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

  let image = sharp(response.body);
  let metadata = await image.metadata();
  expect(metadata.width).toBe(150);
  expect(metadata.format).toBe("jpeg");

  expect(await sharp(response.body).png().toBuffer()).toMatchImageSnapshot({
    customSnapshotIdentifier: "media-thumb-150",
  });

  response = await request
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

  image = sharp(response.body);
  metadata = await image.metadata();
  expect(metadata.width).toBe(200);
  expect(metadata.format).toBe("jpeg");

  expect(await sharp(response.body).png().toBuffer()).toMatchImageSnapshot({
    customSnapshotIdentifier: "media-thumb-200",
  });
});

test("Get media", async (): Promise<void> => {
  const request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdMoment1: Moment = realMoment.tz("2017-02-01T20:30:01", "UTC");
  mockMoment(createdMoment1);
  let { id: id1 } = await user1Db.createMedia("c1", fillMetadata({}));

  let createdMoment2: Moment = realMoment.tz("2010-06-09T09:30:01", "UTC");
  mockMoment(createdMoment2);
  let { id: id2 } = await user1Db.createMedia("c1", fillMetadata({}));

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

  expect(response.body).toEqual([
    fillMetadata({
      id: id1,
      catalog: "c1",
      created: expect.toEqualDate(createdMoment1),

      albums: [],
      tags: [],
      people: [],
    }),
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: id2,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    fillMetadata({
      id: id2,
      catalog: "c1",
      created: expect.toEqualDate(createdMoment2),

      albums: [],
      tags: [],
      people: [],
    }),
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id1},${id2}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    fillMetadata({
      id: id1,
      catalog: "c1",
      created: expect.toEqualDate(createdMoment1),

      albums: [],
      tags: [],
      people: [],
    }),
    fillMetadata({
      id: id2,
      catalog: "c1",
      created: expect.toEqualDate(createdMoment2),

      albums: [],
      tags: [],
      people: [],
    }),
  ]);

  response = await request
    .get("/api/media/get")
    .query({
      id: `${id2},${id1}`,
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual([
    fillMetadata({
      id: id2,
      catalog: "c1",
      created: expect.toEqualDate(createdMoment2),

      albums: [],
      tags: [],
      people: [],
    }),
    fillMetadata({
      id: id1,
      catalog: "c1",
      created: expect.toEqualDate(createdMoment1),

      albums: [],
      tags: [],
      people: [],
    }),
  ]);
});

test("Media relations", async (): Promise<void> => {
  const request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdMoment1: Moment = realMoment.tz("2017-02-01T20:30:01", "UTC");
  mockMoment(createdMoment1);
  let { id: id1 } = await user1Db.createMedia("c1", fillMetadata({}));

  let createdMoment2: Moment = realMoment.tz("2010-06-09T09:30:01", "UTC");
  mockMoment(createdMoment2);
  let { id: id2 } = await user1Db.createMedia("c1", fillMetadata({}));

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

  let media1 = fillMetadata({
    id: id1,
    catalog: "c1",
    created: expect.toEqualDate(createdMoment1),

    albums: [] as Api.Album[],
    tags: [] as Api.Tag[],
    people: [] as Api.Person[],
  });

  let media2 = fillMetadata({
    id: id2,
    catalog: "c1",
    created: expect.toEqualDate(createdMoment2),

    albums: [] as Api.Album[],
    tags: [] as Api.Tag[],
    people: [] as Api.Person[],
  });

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
    "catalog": "c1",
    "id": "t1",
    "name": "tag1",
    "parent": null,
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
    "catalog": "c1",
    "id": "t1",
    "name": "tag1",
    "parent": null,
  }, {
    "catalog": "c1",
    "id": "t2",
    "name": "tag2",
    "parent": null,
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
    "catalog": "c1",
    "id": "t2",
    "name": "tag2",
    "parent": null,
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
    "catalog": "c1",
    "id": "t1",
    "name": "tag1",
    "parent": null,
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
    "catalog": "c1",
    "id": "t2",
    "name": "tag2",
    "parent": null,
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
    "catalog": "c1",
    "id": "t1",
    "name": "tag1",
    "parent": null,
  }];
  media2.tags = [{
    "catalog": "c1",
    "id": "t2",
    "name": "tag2",
    "parent": null,
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
});

test("Media person locations", async (): Promise<void> => {
  const request = agent();
  let db = await connection;
  let user1Db = db.forUser("someone1@nowhere.com");

  let createdMoment1: Moment = realMoment.tz("2017-02-01T20:30:01", "UTC");
  mockMoment(createdMoment1);
  let media1 = await user1Db.createMedia("c1", fillMetadata({}));

  let createdMoment2: Moment = realMoment.tz("2010-06-09T09:30:01", "UTC");
  mockMoment(createdMoment2);
  let media2 = await user1Db.createMedia("c1", fillMetadata({}));

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
    created: expect.toEqualDate(createdMoment1),

    ...emptyMetadata(),

    albums: [],
    tags: [],
    people: [],
  }, {
    id: media2.id,
    catalog: "c1",
    created: expect.toEqualDate(createdMoment2),

    ...emptyMetadata(),

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
    created: expect.toEqualDate(createdMoment1),

    ...emptyMetadata(),

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
    created: expect.toEqualDate(createdMoment2),

    ...emptyMetadata(),

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
    created: expect.toEqualDate(createdMoment1),

    ...emptyMetadata(),

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
    created: expect.toEqualDate(createdMoment2),

    ...emptyMetadata(),

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
    created: expect.toEqualDate(createdMoment2),

    ...emptyMetadata(),

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
    created: expect.toEqualDate(createdMoment1),

    ...emptyMetadata(),

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
    created: expect.toEqualDate(createdMoment2),

    ...emptyMetadata(),

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
