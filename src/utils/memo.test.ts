import { memoized } from "./memo";

test("memo", (): void => {
  let builder1 = jest.fn((a: any, b: any, val1: number, val2: number): { val: number } => ({
    val: val1 + val2,
  }));
  let memo1 = memoized(builder1);
  let builder2 = jest.fn((a: any, b: any, val1: number, val2: number): { val: number } => ({
    val: val1 + val2,
  }));
  let memo2 = memoized(builder2);

  let obj1 = {};
  let obj2 = {};
  let fn1 = (): void => {
    // no-op
  };
  let fn2 = (): void => {
    // no-op
  };

  let result1 = memo1(obj1, fn1, 3, 5);
  expect(result1).toEqual({
    val: 8,
  });
  expect(memo1(obj1, fn1, 3, 5)).toBe(result1);
  expect(memo1(obj1, fn1, 3, 5)).toBe(result1);

  let result2 = memo1(fn1, obj1, 3, 5);
  expect(result2).toEqual(result1);
  expect(result2).not.toBe(result1);

  result2 = memo2(obj1, fn1, 3, 5);
  expect(result2).toEqual(result1);
  expect(result2).not.toBe(result1);

  result2 = memo1(obj1, fn1, 5, 3);
  expect(result2).toEqual(result1);
  expect(result2).not.toBe(result1);

  result2 = memo1(obj2, fn1, 5, 3);
  expect(result2).toEqual(result1);
  expect(result2).not.toBe(result1);

  result2 = memo1(obj1, fn2, 5, 3);
  expect(result2).toEqual(result1);
  expect(result2).not.toBe(result1);
});
