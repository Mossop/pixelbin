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

export { pxExpect as expect };
export * from "./dom";
export * from "./store";
