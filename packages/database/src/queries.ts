import Knex from "knex";

import { Table, TableRecord, ref, isRef } from "./types";
import { WithRefs, intoDBTypes, DBTypes } from "./types/meta";

export async function insert<T extends Table>(
  knex: Knex,
  table: T,
  data: TableRecord<T> | TableRecord<T>[],
): Promise<void> {
  // @ts-ignore: This is correct.
  let dbData = (Array.isArray(data) ? data : [data]).map(intoDBTypes);
  await knex(table).insert(dbData);
}

export async function drop<T extends Table>(
  knex: Knex,
  table: T,
  where: Partial<TableRecord<T>>,
): Promise<void> {
  return knex<TableRecord<T>>(table).where(where).delete();
}

export async function withChildren<T extends Table.Tag | Table.Album>(
  knex: Knex,
  table: T,
  queryBuilder: Knex.QueryBuilder<TableRecord<T>>,
): Promise<Knex.QueryBuilder<TableRecord<T>, TableRecord<T>[]>> {
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

export function insertFromSelect<T extends Table>(
  knex: Knex,
  table: T,
  query: Knex.QueryInterface,
  columns: WithRefs<TableRecord<T>>,
): Knex.QueryBuilder<TableRecord<T>, number[]> {
  // @ts-ignore: Going to have to trust that this is correct.
  let dbColumns = intoDBTypes(columns);
  let names = Object.keys(dbColumns);
  let values: DBTypes[] = Object.values(dbColumns);

  // Builds a raw query like `?? (??, ??, ...)` from insert table name and column names.
  let intoList = knex.raw(
    `?? (${names.map((): string => "??").join(", ")})`,
    [
      table,
      ...names,
    ],
  );

  let bindings: Exclude<DBTypes, null>[] = [];
  let selectList = values.map((value: DBTypes): string => {
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

