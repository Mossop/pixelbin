import { mockedFunction } from "../../test-helpers";
import cli from "./cli";
import { loadConfig } from "./config";
import seed from "./seed";
import serve from "./serve";
import { initDatabase, initStorage } from "./services";

jest.mock("./seed", () => jest.fn(() => Promise.resolve()));
jest.mock("./serve", () => jest.fn(() => Promise.resolve()));
jest.mock("./config", () => ({
  loadConfig: jest.fn(),
}));
jest.mock("./services", () => ({
  initDatabase: jest.fn(),
  initStorage: jest.fn(),
}));

const mockedSeed = mockedFunction(seed);
const mockedServe = mockedFunction(serve);
const mockedLoadConfig = mockedFunction(loadConfig);
const mockedInitDatabase = mockedFunction(initDatabase);
const mockedInitStorage = mockedFunction(initStorage);

test("no config seed", async (): Promise<void> => {
  cli(["seed", "foo"]);

  expect(mockedSeed).toHaveBeenCalledTimes(1);
  expect(mockedSeed).toHaveBeenLastCalledWith(expect.objectContaining({
    file: "foo",
  }));

  expect(mockedServe).not.toHaveBeenCalled();

  expect(mockedLoadConfig).toHaveBeenCalledTimes(1);
  expect(mockedLoadConfig).toHaveBeenLastCalledWith(undefined);

  expect(mockedInitDatabase).toHaveBeenCalledTimes(1);
  expect(mockedInitStorage).toHaveBeenCalledTimes(1);
});

test("config seed", async (): Promise<void> => {
  cli(["--config", "something", "seed", "foo"]);

  expect(mockedSeed).toHaveBeenCalledTimes(1);
  expect(mockedSeed).toHaveBeenLastCalledWith(expect.objectContaining({
    file: "foo",
  }));

  expect(mockedServe).not.toHaveBeenCalled();

  expect(mockedLoadConfig).toHaveBeenCalledTimes(1);
  expect(mockedLoadConfig).toHaveBeenLastCalledWith("something");

  expect(mockedInitDatabase).toHaveBeenCalledTimes(1);
  expect(mockedInitStorage).toHaveBeenCalledTimes(1);
});

test("no config serve", async (): Promise<void> => {
  cli([]);

  expect(mockedSeed).not.toHaveBeenCalled();
  expect(mockedServe).toHaveBeenCalledTimes(1);

  expect(mockedLoadConfig).toHaveBeenCalledTimes(1);
  expect(mockedLoadConfig).toHaveBeenLastCalledWith(undefined);

  expect(mockedInitDatabase).toHaveBeenCalledTimes(1);
  expect(mockedInitStorage).toHaveBeenCalledTimes(1);
});

test("config serve", async (): Promise<void> => {
  cli(["--config", "something"]);

  expect(mockedSeed).not.toHaveBeenCalled();
  expect(mockedServe).toHaveBeenCalledTimes(1);

  expect(mockedLoadConfig).toHaveBeenCalledTimes(1);
  expect(mockedLoadConfig).toHaveBeenLastCalledWith("something");

  expect(mockedInitDatabase).toHaveBeenCalledTimes(1);
  expect(mockedInitStorage).toHaveBeenCalledTimes(1);
});
