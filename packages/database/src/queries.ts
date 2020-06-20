import Knex from "knex";

import { connection } from "./connection";
import { Table, TableRecord, ref } from "./types";

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

export async function insert<T extends Table>(
  table: T,
  data: TableRecord<T> | TableRecord<T>[],
  knex?: Knex,
): Promise<void> {
  if (!knex) {
    knex = await connection;
  }
  await knex(table).insert(data);
}

export async function update<T extends Table>(
  table: T,
  where: Partial<TableRecord<T>>,
  update: Partial<TableRecord<T>>,
  knex?: Knex,
): Promise<void> {
  if (!knex) {
    knex = await connection;
  }
  await knex(table).where(where).update(update);
}

export async function drop<T extends Table>(
  table: T,
  where: Partial<TableRecord<T>>,
  knex?: Knex,
): Promise<void> {
  if (!knex) {
    knex = await connection;
  }
  await knex<TableRecord<T>>(table).where(where).delete();
}

export async function withChildren<T extends Table.Tag | Table.Album>(
  table: T,
  queryBuilder: Knex.QueryBuilder<TableRecord<T>>,
): Promise<Knex.QueryBuilder<TableRecord<T>, TableRecord<T>[]>> {
  let knex = await connection;
  // @ts-ignore: Trust me!
  return knex.withRecursive(
    "parents",
    queryBuilder.select(ref(table)).union((qb: Knex.QueryBuilder) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      qb.from(table).select(ref(table)).join("parents", "parents.id", ref(table, "parent"));
    }),
  ).from("parents");
}
