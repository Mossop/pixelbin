import { expect } from "../test-helpers";
import { ErrorCode } from "../utils/exception";
import {
  QueryRequestData,
  FormRequestData,
  JsonRequestData,
  VoidDecoder,
} from "./helpers";
import { Album } from "./highlevel";

test("QueryRequestData", (): void => {
  let rd = new QueryRequestData({
    a: "foo",
    b: 5,
    c: true,
    d: Album.ref("foobar"),
  }, VoidDecoder);

  let url = new URL("https://example.com/");
  let headers = {};

  rd.applyToHeaders(headers);
  rd.applyToURL(url);

  expect(headers).toEqual({});
  expect(url.toString()).toBe("https://example.com/?a=foo&b=5&c=true&d=foobar");
  expect(rd.body()).toBe(null);
});

test("FormRequestData", (): void => {
  let blob1 = new Blob();
  let blob2 = new Blob();

  let rd = new FormRequestData({
    a: 5,
    b: [
      1,
      2,
      3,
      Album.ref("baz"),
      blob2,
      [4, 5, 6],
    ],
    c: [{
      d: 6,
      e: 7,
      f: Album.ref("foobar"),
    }, {
      d: {
        t: "s",
      },
    }],
    ref: [
      Album.ref("1"),
      Album.ref("2"),
    ],
    blb: blob1,
  }, VoidDecoder);

  let url = new URL("https://example.com/");
  let headers = {};

  rd.applyToHeaders(headers);
  rd.applyToURL(url);

  expect(headers).toEqual({});
  expect(url.toString()).toBe("https://example.com/");
  expect(rd.body()).toEqual({
    "a": "5",
    "b[0]": "1",
    "b[1]": "2",
    "b[2]": "3",
    "b[3]": "baz",
    "b[4]": blob2,
    "b[5][0]": "4",
    "b[5][1]": "5",
    "b[5][2]": "6",
    "c[0]d": "6",
    "c[0]e": "7",
    "c[0]f": "foobar",
    "c[1]d.t": "s",
    "ref[0]": "1",
    "ref[1]": "2",
    "blb": blob1,
  });

  rd = new FormRequestData([1, 2, 3, blob1], VoidDecoder);
  expect(rd.body()).toEqual({
    "[0]": "1",
    "[1]": "2",
    "[2]": "3",
    "[3]": blob1,
  });

  rd = new FormRequestData({
    a: 5,
    b: 6,
    c: [1, 3, 5],
    d: Album.ref("foo6"),
  }, VoidDecoder);
  expect(rd.body()).toEqual(JSON.stringify({
    a: 5,
    b: 6,
    c: [1, 3, 5],
    d: "foo6",
  }));

  rd = new FormRequestData(null, VoidDecoder);
  expect(rd.body()).toEqual({});

  expect((): void => {
    new FormRequestData(5, VoidDecoder);
  }).toThrowAppError(ErrorCode.InvalidData);
});

test("JsonRequestData", (): void => {
  let rd = new JsonRequestData({
    a: 5,
    b: Album.ref("5"),
  }, VoidDecoder);

  let url = new URL("https://example.com/");
  let headers = {};

  rd.applyToHeaders(headers);
  rd.applyToURL(url);

  expect(headers).toEqual({
    "Content-Type": "application/json",
  });
  expect(url.toString()).toBe("https://example.com/");
  expect(rd.body()).toBe(JSON.stringify({
    a: 5,
    b: "5",
  }));

  rd = new JsonRequestData(null, VoidDecoder);
  expect(rd.body()).toBe(null);
});
