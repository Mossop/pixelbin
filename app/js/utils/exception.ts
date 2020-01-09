export enum ErrorCode {
  InvalidState,
  NotLoggedIn,
  UnknownCatalog,
  UnknownAlbum,
  UnknownTag,
  UnknownPerson,
  DecodeError,
}

class InternalError extends Error {
  public constructor(code: ErrorCode, message?: string) {
    if (message) {
      super(`Internal error ${String(code).padStart(3, "0")}: ${message}`);
    } else {
      super(`Internal error ${String(code).padStart(3, "0")}`);
    }
  }
}

export function exception(code: ErrorCode, message?: string): never {
  throw new InternalError(code, message);
}

export function safe<T>(callback: () => T): T | undefined {
  try {
    return callback();
  } catch (e) {
    if (e instanceof InternalError) {
      return undefined;
    }
    throw e;
  }
}
