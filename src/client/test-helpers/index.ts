import { expect as jestExpect } from "@jest/globals";
import { act } from "@testing-library/react";
import { DateTime as Luxon } from "luxon";

import { Api } from "../../model";
import { deferCall, DeferredCall } from "../../test-helpers";
import { DateTime } from "../../utils";
import { request } from "../api/api";
import { ErrorCode, AppError } from "../utils/exception";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBeAppError(received: any, code: ErrorCode | Api.ErrorCode): jest.CustomMatcherResult {
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

function expectMessage(
  context: jest.MatcherContext,
  term: string,
  expected: unknown,
  received: unknown,
): () => string {
  return (): string => {
    return [
      context.utils.matcherHint(term, undefined, undefined, {
        isNot: context.isNot,
        promise: context.promise,
      }),
      "",
      `Expected: ${context.utils.printExpected(expected)}\n`,
      `Received: ${context.utils.printReceived(received)}\n`,
    ].join("\n");
  };
}

const matchers = {
  toEqualDate(
    this: jest.MatcherContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    received: any,
    expected: DateTime | string,
  ): jest.CustomMatcherResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asStr = (val: any): string => {
      if (Luxon.isDateTime(val)) {
        return val.toUTC().toISO();
      }

      return Luxon.fromISO(val, {
        zone: "UTC",
      }).toUTC().toISO();
    };

    const receivedAsString = asStr(received);
    const expectedAsString = asStr(expected);

    return {
      pass: receivedAsString == expectedAsString,
      message: expectMessage(this, "toEqualDate", expectedAsString, receivedAsString),
    };
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toBeRef(received: any, id: string): jest.CustomMatcherResult {
    if (received && typeof received == "object" && "deref" in received && received.id == id) {
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

  toThrowAppError(received: () => void, code: ErrorCode | Api.ErrorCode): jest.CustomMatcherResult {
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

jestExpect.extend(matchers);
export const expect = jestExpect as unknown as jest.ExtendedExpect<typeof matchers>;

export const mapOf = <V>(obj: Record<string, V>): Map<string, V> => new Map(Object.entries(obj));

export function deferRequest<R = unknown, D = unknown>(): DeferredCall<[Api.Method, D], R> {
  let {
    call,
    reject,
    resolve,
    promise,
  } = deferCall(request as unknown as (method: Api.Method, data: D) => Promise<R>);
  return {
    call,
    resolve: async (...args: Parameters<typeof resolve>): Promise<void> => {
      await act(() => {
        return resolve(...args);
      });
    },
    reject: async (...args: Parameters<typeof reject>): Promise<void> => {
      await act(() => {
        return reject(...args);
      });
    },
    promise,
  };
}

export * from "./dom";
export * from "./store";
