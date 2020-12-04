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
  public constructor(
    public readonly code: DatabaseErrorCode,
    public readonly message: string,
    private readonly error?: Error,
  ) {
    super(message);
  }

  public get stack(): string | undefined {
    if (this.error?.stack) {
      return String(this.error.stack);
    }

    return super.stack;
  }
}

function nameFor(table: Table): string {
  switch (table) {
    case Table.MediaInfo:
      return "Media";
    default:
      return table;
  }
}

export function notfound(table: Table): never {
  throw new DatabaseError(DatabaseErrorCode.MissingValue, `Unknown ${nameFor(table)}.`);
}

export function notwritable(table: Table): never {
  throw new DatabaseError(DatabaseErrorCode.NotAuthorized, `Cannot modify ${nameFor(table)}.`);
}
