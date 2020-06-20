import { STATUS_CODES } from "http";

import { Next, DefaultContext, DefaultState, ParameterizedContext, BaseContext } from "koa";

import { LoggingContext } from "./logging";

export enum ApiErrorCode {
  UnknownException = "server-failure",
  LoginFailed = "login-failed",
}

const ApiErrorStatus: Record<ApiErrorCode, number> = {
  [ApiErrorCode.UnknownException]: 500,
  [ApiErrorCode.LoginFailed]: 403,
};

export interface ApiErrorData {
  readonly code: ApiErrorCode;
  readonly data: unknown;
}

export class ApiError extends Error {
  public constructor(
    public readonly code: ApiErrorCode,
    public readonly data: unknown,
  ) {
    super(`Api error: ${code}`);
  }

  public send(ctx: BaseContext): void {
    ctx.status = ApiErrorStatus[this.code];
    ctx.message = STATUS_CODES[ctx.status] ?? "Unknown status";
    ctx.set("Content-Type", "application/json");
    ctx.body = JSON.stringify({
      code: this.code,
      data: this.data,
    });
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
    } else {
      ctx.logger.warn({ error: e }, "Application threw unknown exception");
      error = new ApiError(ApiErrorCode.UnknownException, {
        message: String(e),
      });
    }

    error.send(ctx);
  }
}
