/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { PathLike, Stats } from "fs";
import { promises as fs } from "fs";
import path from "path";

import { mockedFunction } from "../../test-helpers";
import { Level } from "../../utils";
import type { ConfigFile } from "./config";
import { loadConfig } from "./config";

jest.mock("fs", (): any => {
  let realFs = jest.requireActual("fs");
  return {
    ...realFs,
    promises: {
      ...realFs.promises,
      stat: jest.fn(),
      readFile: jest.fn(),
      mkdir: jest.fn(),
    },
  };
});
jest.mock("path", (): any => {
  let realPath = jest.requireActual("path");
  return {
    ...realPath,
    resolve: jest.fn(realPath.resolve),
  };
});
jest.mock("./services", () => {
  let realServices = jest.requireActual("./services");
  return {
    ...realServices,
    // eslint-disable-next-line @typescript-eslint/typedef
    serviceBuilder: (_key, fn) => fn,
  };
});

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedResolved = mockedFunction(path.resolve);
const mockedStat = mockedFunction(fs.stat);
const mockedReadFile = mockedFunction(fs.readFile);

test("no path", async (): Promise<void> => {
  let testConfig: ConfigFile = {
    database: {
      host: "somewhere",
      username: "person",
      password: "password",
      database: "db",
    },
    cache: {
      host: "local",
    },
    hosts: "foo",
  };

  mockedResolved.mockImplementationOnce((target: string) => {
    if (target == "") {
      return "foobar";
    }

    throw new Error("Unexpected call to path.resolve");
  });

  mockedStat.mockImplementation(async (target: PathLike): Promise<Stats> => {
    if (target == "foobar") {
      // @ts-ignore
      return {
        isDirectory: () => true,
        isFile: () => false,
      };
    }

    if (target == "foobar/pixelbin.json") {
      // @ts-ignore
      return {
        isDirectory: () => false,
        isFile: () => true,
      };
    }

    throw new Error("Unexpected call to fs.stat");
  });

  mockedReadFile.mockImplementation(async (path: unknown): Promise<string | Buffer> => {
    if (path == "foobar/pixelbin.json") {
      return JSON.stringify(testConfig);
    }

    throw new Error("Unexpected call to fs.readFile");
  });

  let promise = loadConfig() as unknown as Promise<unknown>;
  let foundConfig = await promise;

  expect(foundConfig).toEqual({
    database: {
      host: "somewhere",
      username: "person",
      password: "password",
      database: "db",
      port: undefined,
    },
    cache: {
      host: "local",
      namespace: undefined,
      port: undefined,
    },
    storage: {
      tempDirectory: "foobar/temp",
      localDirectory: "foobar/local",
    },
    logging: {
      default: Level.Warn,
    },
    smtp: null,
    hosts: ["foo"],
    apiHost: null,
  });
});

test("with directory", async (): Promise<void> => {
  let testConfig: ConfigFile = {
    database: {
      host: "somewhere",
      username: "person",
      password: "password",
      database: "db",
    },
    storage: "somewhere",
    // @ts-ignore
    logging: "silent",
    cache: {
      host: "local",
    },
    smtp: {
      from: "someone@there.com",
      host: "somewhere",
    },
    hosts: ["foo", "bar"],
    apiHost: "baz",
  };

  mockedResolved.mockImplementationOnce((target: string) => {
    if (target == "mydir") {
      return "foobar/mydir";
    }

    throw new Error("Unexpected call to path.resolve");
  });

  mockedStat.mockImplementation(async (target: PathLike): Promise<Stats> => {
    if (target == "foobar/mydir") {
      // @ts-ignore
      return {
        isDirectory: () => true,
        isFile: () => false,
      };
    }

    if (target == "foobar/mydir/pixelbin.json") {
      // @ts-ignore
      return {
        isDirectory: () => false,
        isFile: () => true,
      };
    }

    throw new Error("Unexpected call to fs.stat");
  });

  mockedReadFile.mockImplementation(async (path: unknown): Promise<string | Buffer> => {
    if (path == "foobar/mydir/pixelbin.json") {
      return JSON.stringify(testConfig);
    }

    throw new Error("Unexpected call to fs.readFile");
  });

  let promise = loadConfig("mydir") as unknown as Promise<unknown>;
  let foundConfig = await promise;

  expect(foundConfig).toEqual({
    database: {
      host: "somewhere",
      username: "person",
      password: "password",
      database: "db",
      port: undefined,
    },
    cache: {
      host: "local",
      namespace: undefined,
      port: undefined,
    },
    storage: {
      tempDirectory: "foobar/mydir/somewhere/temp",
      localDirectory: "foobar/mydir/somewhere/local",
    },
    logging: {
      default: Level.Silent,
    },
    smtp: {
      from: "someone@there.com",
      host: "somewhere",
      port: undefined,
      ssl: undefined,
      tls: undefined,
    },
    hosts: [
      "foo",
      "bar",
    ],
    apiHost: "baz",
  });
});
