import type { LocalizedProps, ReactLocalization } from "@fluent/react";

import type { Api } from "../../model";

export enum ErrorCode {
  InvalidResponse = "invalid-response",
  InvalidState = "invalid-state",
  NotLoggedIn = "not-logged-in",
  UnknownCatalog = "unknown-catalog",
  UnknownSearch = "unknown-search",
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
  public readonly code: ErrorCode | Api.ErrorCode;
  public readonly args: Record<string, string> | undefined;
  public readonly error: Error | undefined;

  public constructor(
    code: ErrorCode | Api.ErrorCode,
    args?: Record<string, string>,
    error?: Error,
  ) {
    let message = `Exception ${code}`;
    if (error) {
      message += `: ${error}`;
    }
    if (args) {
      message += ` (${JSON.stringify(args)})`;
    }

    super(message);

    this.code = code;
    this.args = args;
    this.error = error;
  }

  public abstract l10nInfo(): LocalizedProps;

  public asString(l10n: ReactLocalization): string {
    let info = this.l10nInfo();
    if (typeof info == "string") {
      return l10n.getString(info);
    }
    return l10n.getString(info.id, info.vars);
  }
}

export class ApiError extends AppError {
  public constructor(
    public readonly httpCode: number,
    public readonly httpStatus: string,
    data: Api.ErrorData,
  ) {
    super(data.code, data.data);
  }

  public l10nInfo(): LocalizedProps {
    return {
      id: `api-error-${this.code}`,
      vars: this.args,
    };
  }
}

export class InternalError extends AppError {
  public l10nInfo(): LocalizedProps {
    return {
      id: `internal-error-${this.code}`,
      vars: this.args,
    };
  }
}

export function exception(code: ErrorCode, args?: Record<string, string>, error?: Error): never {
  throw new InternalError(code, args, error);
}

export function errorString(l10n: ReactLocalization, error: unknown): string {
  if (error instanceof AppError) {
    return error.asString(l10n);
  }

  return String(error);
}
