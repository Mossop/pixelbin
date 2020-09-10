export enum DatabaseErrorCode {
  UnknownError,
  MissingValue,
  MissingRelationship,
}

export class DatabaseError extends Error {
  public constructor(public readonly code: DatabaseErrorCode, public readonly message: string) {
    super(message);
  }
}