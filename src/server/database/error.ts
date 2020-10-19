import { Table } from "./types";

export enum DatabaseErrorCode {
  UnknownError,
  MissingValue,
  MissingRelationship,
  InvalidSearch,
  NotAuthorized,
  BadRequest,
}

export class DatabaseError extends Error {
  public constructor(public readonly code: DatabaseErrorCode, public readonly message: string) {
    super(message);
  }
}

export function notfound(table: Table): never {
  throw new DatabaseError(DatabaseErrorCode.MissingValue, `Unknown ${table}.`);
}

export function notwritable(table: Table): never {
  throw new DatabaseError(DatabaseErrorCode.NotAuthorized, `Cannot modify ${table}.`);
}
