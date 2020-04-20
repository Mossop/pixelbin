import { ApiErrorData, ApiErrorCode } from "../api/types";
import { l10nInfo, L10nInfo } from "../l10n";

export enum ErrorCode {
  InvalidResponse = "invalid-response",
  InvalidState = "invalid-state",
  NotLoggedIn = "not-logged-in",
  UnknownCatalog = "unknown-catalog",
  UnknownAlbum = "unknown-album",
  UnknownTag = "unknown-tag",
  UnknownPerson = "unknown-person",
  DecodeError = "decode-error",
  InvalidData = "invalid-data",
  RequestFailed = "request-failed",
  UnknownField = "unknown-field",
  UnexpectedType = "unexpected-type",
}

export abstract class AppError extends Error {
  public constructor(
    protected code: ErrorCode | ApiErrorCode,
    protected args?: Record<string, string>,
    protected error?: Error,
  ) {
    super(`Exception ${code}: ${JSON.stringify(args)}`);
  }

  public abstract l10nInfo(): L10nInfo;
}

export class ApiError extends AppError {
  public constructor(
    protected httpCode: number,
    protected httpStatus: string,
    data: ApiErrorData,
  ) {
    super(data.code, data.args);
  }

  public l10nInfo(): L10nInfo {
    return l10nInfo(`api-error-${this.code}`, this.args);
  }
}

export class InternalError extends AppError {
  public l10nInfo(): L10nInfo {
    return l10nInfo(`internal-error-${this.code}`, this.args);
  }
}

export function exception(code: ErrorCode, args?: Record<string, string>, error?: Error): never {
  throw new InternalError(code, args, error);
}
