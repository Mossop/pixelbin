import { STATUS_CODES } from "http";

import type { Next, DefaultContext, DefaultState, ParameterizedContext, BaseContext } from "koa";

import type { Api } from "../../model";
import { ErrorCode } from "../../model";
import { DatabaseError, DatabaseErrorCode } from "../database";
import type { LoggingContext } from "./logging";

const ApiErrorStatus: Record<ErrorCode, number> = {
  [ErrorCode.UnknownException]: 500,
  [ErrorCode.BadMethod]: 405,
  [ErrorCode.NotLoggedIn]: 401,
  [ErrorCode.LoginFailed]: 401,
  [ErrorCode.InvalidData]: 400,
  [ErrorCode.NotFound]: 404,
  [ErrorCode.TemporaryFailure]: 503,
};

export class ApiError extends Error {
  public constructor(
    public readonly code: ErrorCode,
    public readonly data?: Record<string, string>,
  ) {
    super(`Api error: ${code}`);
  }

  public send(ctx: BaseContext): void {
    let body: Api.ErrorData = {
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
    ctx.logger.trace({ request: ctx.request }, "Request start");
    await next();
  } catch (e) {
    let error: ApiError;
    if (e instanceof ApiError) {
      ctx.logger.trace(e, "Request threw an exception.");
      error = e;
    } else if (e instanceof DatabaseError) {
      ctx.logger.warn(e, "Database error occured.");

      let code = ErrorCode.InvalidData;
      switch (e.code) {
        case DatabaseErrorCode.MissingRelationship:
          code = ErrorCode.NotFound;
          break;
        case DatabaseErrorCode.MissingValue:
          code = ErrorCode.NotFound;
          break;
      }

      error = new ApiError(code, {
        message: String(e),
      });
    } else {
      ctx.logger.warn(e, "Application threw unknown exception.");
      error = new ApiError(ErrorCode.UnknownException, {
        message: String(e),
      });
    }

    error.send(ctx);
  }

  ctx.logger.trace("Request done");
}
