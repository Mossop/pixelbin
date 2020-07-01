import { Buffer } from "buffer";

import mockConsole from "jest-mock-console";
import { Orientation, parseBuffer, Metadata } from "media-metadata";

import { mockedFunction } from "../../../test-helpers";
import {
  areDimensionsFlipped,
  peopleFromString,
  peopleToString,
  tagsFromString,
  tagsToString,
  parseMetadata,
  getTransformForOrientation,
} from "./metadata";

/* eslint-disable */
jest.mock("media-metadata", () => {
  return {
    ...jest.requireActual<typeof import("media-metadata")>("media-metadata"),
    parseBuffer: jest.fn(),
  };
});
/* eslint-enable */

const mockedParser = mockedFunction(parseBuffer);

test("areDimensionsFlipped", (): void => {
  expect(areDimensionsFlipped(Orientation.BottomLeft)).toBeFalsy();
  expect(areDimensionsFlipped(Orientation.BottomRight)).toBeFalsy();
  expect(areDimensionsFlipped(Orientation.TopLeft)).toBeFalsy();
  expect(areDimensionsFlipped(Orientation.TopRight)).toBeFalsy();
  expect(areDimensionsFlipped(Orientation.LeftBottom)).toBeTruthy();
  expect(areDimensionsFlipped(Orientation.LeftTop)).toBeTruthy();
  expect(areDimensionsFlipped(Orientation.RightBottom)).toBeTruthy();
  expect(areDimensionsFlipped(Orientation.RightTop)).toBeTruthy();
});

test("transforms", (): void => {
  expect(getTransformForOrientation()).toBeUndefined();
  expect(getTransformForOrientation(Orientation.BottomLeft)).toBe("scale(1, -1)");
  expect(getTransformForOrientation(Orientation.BottomRight)).toBe("scale(-1, -1)");
  expect(getTransformForOrientation(Orientation.TopLeft)).toBeUndefined();
  expect(getTransformForOrientation(Orientation.TopRight)).toBe("scale(-1, 1)");
  expect(getTransformForOrientation(Orientation.LeftBottom)).toBe("rotate(-90)");
  expect(getTransformForOrientation(Orientation.LeftTop)).toBe("scale(1, -1) rotate(-90)");
  expect(getTransformForOrientation(Orientation.RightBottom)).toBe("scale(1, -1) rotate(90)");
  expect(getTransformForOrientation(Orientation.RightTop)).toBe("rotate(90)");
});

test("people", (): void => {
  let people = `Bob Smith,Andrew Latch,,, ,,Helen Briggs , Sarah Delong
  Jim Broad,
, Derek Smythe,
,
Jenny Brads



Deborah Banks

`;
  expect(peopleFromString(people)).toEqual([
    "Bob Smith",
    "Andrew Latch",
    "Helen Briggs",
    "Sarah Delong",
    "Jim Broad",
    "Derek Smythe",
    "Jenny Brads",
    "Deborah Banks",
  ]);

  expect(peopleToString([
    "Bob Smith",
    "Andrew Latch",
    "",
    "Sarah Delong",
    "Jim Broad",
  ])).toBe(`Bob Smith
Andrew Latch
Sarah Delong
Jim Broad`);
});

test("tags", (): void => {
  let tags = `a,b, ,, c d,
ef,g ,hgh
ijk

,
,
l/m/n/o
p/
qr/ //s`;
  expect(tagsFromString(tags)).toEqual([
    ["a"],
    ["b"],
    ["c d"],
    ["ef"],
    ["g"],
    ["hgh"],
    ["ijk"],
    ["l", "m", "n", "o"],
    ["p"],
    ["qr", "s"],
  ]);

  expect(tagsToString([
    ["a"],
    ["b"],
    ["c d"],
    ["ef"],
    ["g"],
    ["hgh"],
    ["ijk"],
    ["l", "m", "n", "o"],
    ["p"],
    ["qr", "s"],
  ])).toBe("a, b, c d, ef, g, hgh, ijk, l/m/n/o, p, qr/s");
});

test("blob", async (): Promise<void> => {
  mockConsole();

  let file = new File(["This is a test blob!"], "foobar.jpg");

  mockedParser.mockImplementationOnce(
    (): Promise<Metadata> => Promise.resolve("foo" as unknown as Metadata),
  );
  let metadata = await parseMetadata(file);
  expect(metadata).toBe("foo");

  expect(mockedParser).toHaveBeenCalledTimes(1);
  let arrayBuffer = mockedParser.mock.calls[0][0];
  let buffer = Buffer.from(arrayBuffer);
  expect(buffer.toString()).toBe("This is a test blob!");

  mockedParser.mockImplementationOnce((): never => {
    throw new Error("Bad metadata");
  });
  expect(await parseMetadata(file)).toBe(null);
});
