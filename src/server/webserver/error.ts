import { STATUS_CODES } from "http";

import { Next, DefaultContext, DefaultState, ParameterizedContext, BaseContext } from "koa";

import { DatabaseError } from "../database";
import { LoggingContext } from "./logging";

export enum ApiErrorCode {
  UnknownException = "server-failure",
  BadMethod = "bad-method",
  NotLoggedIn = "not-logged-in",
  LoginFailed = "login-failed",
  InvalidData = "invalid-data",
  NotFound = "not-found",
}

const ApiErrorStatus: Record<ApiErrorCode, number> = {
  [ApiErrorCode.UnknownException]: 500,
  [ApiErrorCode.BadMethod]: 405,
  [ApiErrorCode.NotLoggedIn]: 401,
  [ApiErrorCode.LoginFailed]: 401,
  [ApiErrorCode.InvalidData]: 400,
  [ApiErrorCode.NotFound]: 404,
};

export interface ApiErrorData {
  readonly code: ApiErrorCode;
  readonly data: unknown;
}

export class ApiError extends Error {
  public constructor(
    public readonly code: ApiErrorCode,
    public readonly data?: Record<string, unknown>,
  ) {
    super(`Api error: ${code}`);
  }

  public send(ctx: BaseContext): void {
    let body: ApiErrorData = {
      code: this.code,
      data: this.data,
    };

    ctx.status = ApiErrorStatus[this.code];
    ctx.message = STATUS_CODES[ctx.status] ?? "Unknown status";
    ctx.set("Content-Type", "application/json");
    ctx.body = JSON.stringify(body);
  }
}

export async function errorHandler(
  ctx: ParameterizedContext<DefaultState, DefaultContext & LoggingContext>,
  next: Next,
): Promise<void> {
  try {
    await next();
  } catch (e) {
    let error: ApiError;
    if (e instanceof ApiError) {
      error = e;
    } else if (e instanceof DatabaseError) {
      error = new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
      });
    } else {
      ctx.logger.warn(e, "Application threw unknown exception");
      error = new ApiError(ApiErrorCode.UnknownException, {
        message: String(e),
      });
    }

    error.send(ctx);
  }
}
