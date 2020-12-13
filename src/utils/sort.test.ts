import { binarySearch, numberComparator } from "./sort";

test("Binary search", () => {
  expect(binarySearch([
    0, 3, 6, 7,
  ], 5, numberComparator)).toBe(2);

  expect(binarySearch([
    0,
  ], 5, numberComparator)).toBe(1);

  expect(binarySearch([
    7,
  ], 5, numberComparator)).toBe(0);

  expect(binarySearch([
  ], 5, numberComparator)).toBe(0);

  let result = binarySearch([
    0, 5, 5, 5, 5, 7,
  ], 5, numberComparator);
  expect(result).toBeGreaterThanOrEqual(1);
  expect(result).toBeLessThanOrEqual(5);

  expect(binarySearch([
    2, 4, 5, 7,
  ], 5, numberComparator)).toBe(2);

  expect(binarySearch([
    0, 7, 8,
  ], 5, numberComparator)).toBe(1);

  expect(binarySearch([
    0, 2, 8,
  ], 5, numberComparator)).toBe(2);

  result = binarySearch([
    5, 7, 8, 17,
  ], 5, numberComparator);
  expect(result).toBeGreaterThanOrEqual(0);
  expect(result).toBeLessThanOrEqual(1);

  result = binarySearch([
    1, 2, 3, 5,
  ], 5, numberComparator);
  expect(result).toBeGreaterThanOrEqual(3);
  expect(result).toBeLessThanOrEqual(4);
});
