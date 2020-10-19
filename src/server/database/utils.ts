import Knex from "knex";

import { ObjectModel } from "../../model";
import { Func } from "../../utils";
import type { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { Table, COLUMNS } from "./types";

export type TxnFn<C, R> = Func<[dbConnection: C], Promise<R>>;
export type Named<F> = [name: string, transactionFn: F] | [transactionFn: F];

export function filterColumns<T extends Table.Media, D>(table: T, data: D): D {
  let allowed = COLUMNS[table];
  return Object.fromEntries(Object.entries(data).filter(([key]: [string, unknown]): boolean => {
    return allowed.includes(key);
  })) as unknown as D;
}

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

export function inUserTransaction<A extends unknown[], R>(
  ...args: Named<Func<A, Promise<R>, UserScopedConnection>>
): Func<A, Promise<R>, UserScopedConnection> {
  let name: string;
  let fn: Func<A, Promise<R>, UserScopedConnection>;
  if (args.length == 2) {
    [name, fn] = args;
  } else {
    fn = args[0];
    name = fn.name;
  }

  return function(this: UserScopedConnection, ...args: A): Promise<R> {
    return this.inTransaction(name, (userDb: UserScopedConnection): Promise<R> => {
      return fn.apply(userDb, args);
    });
  };
}
