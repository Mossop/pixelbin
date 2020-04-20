import { isReference } from "../../js/api/highlevel";

expect.extend({
  toBeRef(received: unknown, id: string): jest.CustomMatcherResult {
    if (isReference(received) && received.id == id) {
      return {
        message: (): string => `expected ${received} not to be a reference with id ${id}`,
        pass: true,
      };
    } else {
      return {
        message: (): string => `expected ${received} to be a reference with id ${id}`,
        pass: false,
      };
    }
  },
});

type ExtendedExpect = jest.Expect & {
  toBeRef: (id: string) => void;
};

const pxExpect = expect as ExtendedExpect;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockedFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  expect("mock" in fn).toBeTruthy();
  return fn as jest.MockedFunction<T>;
}

export function mockedClass<T extends jest.Constructable>(cls: T): jest.MockedClass<T> {
  expect("mock" in cls).toBeTruthy();
  return cls as jest.MockedClass<T>;
}

export { pxExpect as expect };
export * from "./dom";
export * from "./store";
