import { expect as jestExpect } from "@jest/globals";
import moment from "moment";
import { isMoment, Moment } from "moment-timezone";

import { Api, ResponseFor } from "../../../model";
import { deferCall, DeferredCall } from "../../../test-helpers";
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
    expected: Moment | string,
  ): jest.CustomMatcherResult {
    const receivedMoment = isMoment(received) ? received.utc() : moment.tz(received, "UTC");
    const expectedMoment = isMoment(expected) ? expected.utc() : moment.tz(expected, "UTC");

    const receivedAsString = receivedMoment.format("L");
    const expectedAsString = expectedMoment.format("L");

    const pass = receivedMoment.isSame(expectedMoment);

    return {
      pass,
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return deferCall(request as unknown as (method: Api.Method, data: D) => Promise<R>);
}

export * from "./dom";
export * from "./store";
