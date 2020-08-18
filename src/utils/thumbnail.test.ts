import { chooseSize, Image } from "./thumbnail";

test("size choice", (): void => {
  expect(chooseSize([], 200)).toBeNull();

  let items: Image[] = [{
    width: 100,
    height: 100,
  }, {
    width: 400,
    height: 400,
  }, {
    width: 200,
    height: 200,
  }, {
    width: 150,
    height: 150,
  }];

  expect(chooseSize(items, 200)).toBe(items[2]);
  expect(chooseSize(items, 201)).toBe(items[1]);
  expect(chooseSize(items, 101)).toBe(items[3]);
  expect(chooseSize(items, 75)).toBe(items[3]);

  items = [{
    width: 100,
    height: 50,
  }, {
    width: 20,
    height: 400,
  }, {
    width: 80,
    height: 200,
  }, {
    width: 10,
    height: 150,
  }];

  expect(chooseSize(items, 200)).toBe(items[2]);
  expect(chooseSize(items, 201)).toBe(items[1]);
  expect(chooseSize(items, 101)).toBe(items[3]);
  expect(chooseSize(items, 75)).toBe(items[3]);
});
