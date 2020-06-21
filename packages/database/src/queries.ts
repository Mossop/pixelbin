import Knex from "knex";

import { connection } from "./connection";
import { Table, TableRecord, ref, Ref, isRef } from "./types";

export async function insert<T extends Table>(
  table: T,
  data: TableRecord<T> | TableRecord<T>[],
  knex?: Knex,
): Promise<void> {
  knex = knex ?? await connection;
  await knex(table).insert(data);
}

export async function update<T extends Table>(
  table: T,
  where: Partial<TableRecord<T>>,
  update: Partial<TableRecord<T>>,
  knex?: Knex,
): Promise<void> {
  knex = knex ?? await connection;
  return knex(table).where(where).update(update);
}

export async function drop<T extends Table>(
  table: T,
  where: Partial<TableRecord<T>>,
  knex?: Knex,
): Promise<void> {
  knex = knex ?? await connection;
  return knex<TableRecord<T>>(table).where(where).delete();
}

export async function withChildren<T extends Table.Tag | Table.Album>(
  table: T,
  queryBuilder: Knex.QueryBuilder<TableRecord<T>>,
  knex?: Knex,
): Promise<Knex.QueryBuilder<TableRecord<T>, TableRecord<T>[]>> {
  knex = knex ?? await connection;
  // @ts-ignore: Trust me!
  return knex.withRecursive(
    "parents",
    queryBuilder.select(ref(table)).union((qb: Knex.QueryBuilder): void => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      qb.from(table)
        .select(ref(table))
        .join("parents", "parents.id", ref(table, "parent"));
    }),
  ).from("parents");
}

type ColumnTypes = null | string | number | Ref;
export function insertFromSelect<T extends Table>(
  knex: Knex,
  table: T,
  query: Knex.QueryInterface,
  columns: Record<keyof TableRecord<T>, ColumnTypes>,
): Knex.QueryBuilder<TableRecord<T>, number[]> {
  let names = Object.keys(columns);
  let values: ColumnTypes[] = Object.values(columns);

  // Builds a raw query like `?? (??, ??, ...)` from insert table name and column names.
  let intoList = knex.raw(
    `?? (${names.map((): string => "??").join(", ")})`,
    [
      table,
      ...names,
    ],
  );

  let bindings: (string | number | Ref)[] = [];
  let selectList = values.map((value: ColumnTypes): string => {
    if (value === null) {
      return "NULL";
    }

    bindings.push(value);

    return isRef(value) ? "??" : "?";
  });

  return knex.into(intoList).insert(query.select(knex.raw(selectList.join(", "), bindings)));
}

// Because DeferredKeySelection is private in knex it is impossible to correctly
// define the types of these functions, just let TypeScript infer them.

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function from<
  T extends Table,
  TRecord extends {} = any,
  TResult = unknown[]
>(
  knex: Knex.QueryInterface<TRecord, TResult>,
  tableName: T,
) {
  return knex.table<TableRecord<T>>(tableName);
}

export const into = from;
export const table = from;

