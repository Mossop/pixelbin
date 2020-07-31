import Knex from "knex";

import { Table, TableRecord, ref, isRef, WithRefs, intoDBTypes } from "./types";

export type QueryBuilder<T, R = T[]> = Knex.QueryBuilder<T, R>;

export async function drop<T extends Table>(
  knex: Knex,
  table: T,
  where: Partial<TableRecord<T>>,
): Promise<void> {
  return knex<TableRecord<T>>(table).where(where).delete();
}

export async function select<T extends Table>(
  query: Knex.QueryBuilder,
  table: T,
): Promise<TableRecord<T>[]> {
  return query.select(`${table}.*`);
}

export async function withChildren<T extends Table.Tag | Table.Album>(
  knex: Knex,
  table: T,
  queryBuilder: QueryBuilder<TableRecord<T>>,
): Promise<QueryBuilder<TableRecord<T>>> {
  // @ts-ignore: Trust me!
  return knex.withRecursive(
    "parents",
    queryBuilder.select(ref(table)).union((qb: Knex.QueryBuilder): void => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      qb.from<TableRecord<T>>(table)
        .select(`${table}.*`)
        .join("parents", "parents.id", `${table}.parent`);
    }),
  ).from("parents");
}

export function insertFromSelect<T extends Table>(
  knex: Knex,
  table: T,
  query: Knex.QueryInterface,
  columns: WithRefs<TableRecord<T>>,
): Knex.QueryBuilder<TableRecord<T>, number[]> {
  let names = Object.keys(columns);
  let values: (Knex.RawBinding | null)[] = Object.values(columns);

  // Builds a raw query like `?? (??, ??, ...)` from insert table name and column names.
  let intoList = knex.raw(
    `?? (${names.map((): string => "??").join(", ")})`,
    [
      table,
      ...names,
    ],
  );

  let bindings: Knex.RawBinding[] = [];
  let selectList = values.map((value: Knex.RawBinding | null): string => {
    if (value === null) {
      return "NULL";
    }

    bindings.push(value);

    return isRef(value) ? "??" : "?";
  });

  return knex.into(intoList).insert(query.select(knex.raw(selectList.join(", "), bindings)));
}

export function update<T extends Table>(
  table: T,
  query: Knex.QueryInterface,
  columns: WithRefs<Partial<TableRecord<T>>>,
): Knex.QueryBuilder<TableRecord<T>, number> {
  // @ts-ignore: Going to have to trust that this is correct.
  return query.into<TableRecord<T>>(table).update(intoDBTypes(columns));
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

export function insert<T extends Table>(
  knex: Knex,
  table: T,
  data: TableRecord<T> | TableRecord<T>[],
) {
  // @ts-ignore: This is correct.
  let dbData: TableRecord<T>[] = (Array.isArray(data) ? data : [data]).map(intoDBTypes);
  // @ts-ignore: This is also correct.
  return knex<TableRecord<T>>(table).insert(dbData);
}
