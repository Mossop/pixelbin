import { STATUS_CODES } from "http";

import { Next, DefaultContext, DefaultState, ParameterizedContext, BaseContext } from "koa";

import { Api } from "../../model";
import { DatabaseError } from "../database";
import { LoggingContext } from "./logging";

const ApiErrorStatus: Record<Api.ErrorCode, number> = {
  [Api.ErrorCode.UnknownException]: 500,
  [Api.ErrorCode.BadMethod]: 405,
  [Api.ErrorCode.NotLoggedIn]: 401,
  [Api.ErrorCode.LoginFailed]: 401,
  [Api.ErrorCode.InvalidData]: 400,
  [Api.ErrorCode.NotFound]: 404,
};

export class ApiError extends Error {
  public constructor(
    public readonly code: Api.ErrorCode,
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
      error = new ApiError(Api.ErrorCode.InvalidData, {
        message: String(e),
      });
    } else {
      ctx.logger.warn(e, "Application threw unknown exception.");
      error = new ApiError(Api.ErrorCode.UnknownException, {
        message: String(e),
      });
    }

    error.send(ctx);
  }

  ctx.logger.trace("Request done");
}
