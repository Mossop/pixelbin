import moment, { Moment } from "moment";
import { fillMetadata } from "pixelbin-database";
import {
  initDB,
  resetDB,
  destroyDB,
  insertTestData,
} from "pixelbin-database/build/test-helpers";
// @ts-ignore: Mocked module
import { getStorage, StorageMock } from "pixelbin-storage";
import { expect, mockedFunction } from "pixelbin-test-helpers";

import { ApiErrorCode } from "../error";
import { buildTestApp } from "../test-helpers";

jest.mock("pixelbin-storage");
jest.mock("moment");

beforeAll(initDB);
beforeEach(resetDB);
afterAll(destroyDB);

beforeEach(insertTestData);

const { agent } = buildTestApp(afterAll);

const mockStorageServiceGetter = mockedFunction(getStorage);
const mockedMoment = mockedFunction(moment);
const realMoment: typeof moment = jest.requireActual("moment");

mockedMoment.mockImplementation((): Moment => realMoment());

test("Media upload", async (): Promise<void> => {
  const request = agent();

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

  let createdMoment: Moment = realMoment("2016-01-01T23:35:01");
  mockedMoment.mockImplementationOnce((): Moment => {
    return createdMoment;
  });

  response = await request
    .put("/api/media/create")
    .field("catalog", "c1")
    .attach("file", Buffer.from("my file"), {
      filename: "myfile.jpg",
    })
    .expect("Content-Type", "application/json")
    .expect(200);

  expect(response.body).toEqual(fillMetadata({
    id: expect.stringMatching(/M:[a-zA-Z0-9]+/),
    created: expect.toEqualDate(createdMoment),
    catalog: "c1",
  }));

  expect(mockStorageServiceGetter).toHaveBeenCalledTimes(1);
  expect(mockStorageServiceGetter).toHaveBeenLastCalledWith(response.body.id);
});
