import { bound } from "./utility";

test("bound", (): void => {
  let check = {
    val: 5,
    fn(): number {
      return this.val;
    },
  };

  let iface = {
    val: 6,
    foo(this: typeof check): number {
      return this.val;
    },
  };

  let wrapped = bound(iface, check);
  expect(wrapped).not.toBe(iface);
  expect(wrapped).not.toBe(check);
  expect(wrapped.val).toBe(6);
  expect(wrapped["fn"]).toBeUndefined();
  expect(wrapped.foo()).toBe(5);
});
