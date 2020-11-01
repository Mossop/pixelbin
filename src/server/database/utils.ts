import type Knex from "knex";

import type { ObjectModel } from "../../model";
import type { Func } from "../../utils";
import type { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";

export type TxnFn<C, R> = Func<[dbConnection: C], Promise<R>>;
export type Named<F> = [name: string, transactionFn: F] | [transactionFn: F];

export function rowFromLocation(
  knex: Knex,
  location: ObjectModel.Location | null | undefined,
): Knex.Raw {
  if (!location) {
    return knex.raw("NULL::location");
  }

  return knex.raw("ROW(?, ?, ?, ?)::location", [
    location.left,
    location.right,
    location.top,
    location.bottom,
  ]);
}

export function asTable(
  knex: Knex,
  values: Knex.Value[],
  table: string,
  column: string,
  index?: string,
): Knex.Raw {
  if (values.length == 0) {
    throw new DatabaseError(
      DatabaseErrorCode.BadRequest,
      "Attempt to use an empty array as a table.",
    );
  }

  if (index) {
    let elements: string[] = [];
    let bindings: Knex.Value[] = [];

    values.forEach((value: Knex.Value, index: number) => {
      elements.push("(?, ?)");
      bindings.push(index);
      bindings.push(value);
    });

    return knex.raw(
      `(VALUES ${elements}) AS ?? (??, ??)`,
      [
        ...bindings,
        table,
        index,
        column,
      ],
    );
  }

  return knex.raw(
    `(VALUES ${values.map((): string => "(?)").join(", ")}) AS ?? (??)`,
    [
      ...values,
      table,
      column,
    ],
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function named<F extends (...args: any[]) => any>(args: Named<F>): [string, F] {
  if (args.length == 2) {
    return args;
  }

  let fn = args[0];
  let name = fn.name;
  if (!name) {
    throw new DatabaseError(DatabaseErrorCode.BadRequest, "Must provide a transaction name.");
  }

  return [name, fn];
}

export function inUserTransaction<A extends unknown[], R>(
  ...args: Named<Func<A, Promise<R>, UserScopedConnection>>
): Func<A, Promise<R>, UserScopedConnection> {
  let [name, fn] = named(args);

  return function(this: UserScopedConnection, ...args: A): Promise<R> {
    return this.inTransaction(name, (userDb: UserScopedConnection): Promise<R> => {
      return fn.apply(userDb, args);
    });
  };
}

export function ensureUserTransaction<A extends unknown[], R>(
  ...args: Named<Func<A, Promise<R>, UserScopedConnection>>
): Func<A, Promise<R>, UserScopedConnection> {
  let [name, fn] = named(args);

  return function(this: UserScopedConnection, ...args: A): Promise<R> {
    return this.ensureTransaction(name, (userDb: UserScopedConnection): Promise<R> => {
      return fn.apply(userDb, args);
    });
  };
}

export function deleteFields<T>(value: T, fields: string[]): T {
  let result: T = {
    ...value,
  };

  for (let field of fields) {
    delete result[field];
  }

  return result;
}
