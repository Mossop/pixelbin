import { deferCall, DeferredCall } from "pixelbin-test-helpers";

import { isReference } from "../api/highlevel";
import request from "../api/request";
import { ApiErrorCode, ApiMethod } from "../api/types";
import { ErrorCode, AppError } from "../utils/exception";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBeAppError(received: any, code: ErrorCode | ApiErrorCode): jest.CustomMatcherResult {
  if (received instanceof AppError) {
    if (received.code == code) {
      return {
        message: (): string => `Did not expect AppError code ${received.code}.`,
        pass: true,
      };
    } else {
      return {
        message: (): string => `Expected AppError code ${code} but got ${received.code}.`,
        pass: false,
      };
    }
  } else {
    return {
      message: (): string => `Expected an AppError but got ${received}.`,
      pass: false,
    };
  }
}

const matchers = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toBeRef(received: any, id: string): jest.CustomMatcherResult {
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

  toThrowAppError(received: () => void, code: ErrorCode | ApiErrorCode): jest.CustomMatcherResult {
    try {
      received();
      return {
        message: (): string => `expected ${received} to throw an exception.`,
        pass: false,
      };
    } catch (e) {
      return toBeAppError(e, code);
    }
  },

  toBeAppError,
};

expect.extend(matchers);

const jestExpect = expect as unknown as jest.ExtendedExpect<typeof matchers>;

export const mapOf = <V>(obj: Record<string, V>): Map<string, V> => new Map(Object.entries(obj));

export function deferRequest<R = unknown, D = unknown>(): DeferredCall<[ApiMethod, D], R> {
  return deferCall(request as unknown as (method: ApiMethod, data: D) => Promise<R>);
}

export { jestExpect as expect };
export * from "./dom";
export * from "./store";
