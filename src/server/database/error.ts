export enum DatabaseErrorCode {
  UnknownError,
  MissingRelationship,
}

export class DatabaseError extends Error {
  public constructor(public readonly code: DatabaseErrorCode, public readonly message: string) {
    super(message);
  }
}
