import { ApiError } from "../error";
import { decodeBody } from "./methods";

test("body decode", (): void => {
  expect(decodeBody({
    a: "b",
    b: 5,
    "c[0]": 57,
    "d.c": 45,
    "e[0]": 4,
    "e[1]": 5,
    "f[0].t.g[0].f": 34,
    "f[1].t.g[0].f": 67,
    "g[0][0]": 7,
    "g[0][1]": 8,
    "g[1]": "hello",
  })).toEqual({
    a: "b",
    b: 5,
    c: [57],
    d: {
      c: 45,
    },
    e: [4, 5],
    f: [{
      t: {
        g: [{
          f: 34,
        }],
      },
    }, {
      t: {
        g: [{
          f: 67,
        }],
      },
    }],
    g: [
      [7, 8],
      "hello",
    ],
  });

  expect(() => decodeBody({
    "a.": 5,
  })).toThrow(ApiError);

  expect(() => decodeBody({
    "a": 5,
    "a.b": 6,
  })).toThrow(ApiError);

  expect(() => decodeBody({
    "a[0]": 5,
    "a.b": 6,
  })).toThrow(ApiError);
});
