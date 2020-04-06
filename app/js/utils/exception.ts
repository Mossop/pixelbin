import { ApiErrorData, ApiErrorCode } from "../api/types";
import { l10nAttributes, LocalizedProps } from "../l10n";

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
}

export abstract class AppError extends Error {
  public constructor(
    protected code: ErrorCode | ApiErrorCode,
    protected args?: Record<string, string>,
  ) {
    super(`Exception ${code}: ${JSON.stringify(args)}`);
  }

  public abstract l10nAttributes(): LocalizedProps;
}

export class ApiError extends AppError {
  public constructor(
    _httpCode: number,
    _httpStatus: string,
    data: ApiErrorData,
  ) {
    super(data.code, data.args);
  }

  public l10nAttributes(): LocalizedProps {
    return l10nAttributes(`api-error-${this.code}`, this.args);
  }
}

export class InternalError extends AppError {
  public l10nAttributes(): LocalizedProps {
    return l10nAttributes(`internal-error-${this.code}`, this.args);
  }
}

export function exception(code: ErrorCode, args?: Record<string, string>): never {
  processException(new InternalError(code, args));
}

export function processException(error: AppError): never {
  console.error(error);
  throw error;
}
