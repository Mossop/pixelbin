import Knex from "knex";

import { connection } from "./connection";
import { Table, TableRecord } from "./types";

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
): Promise<void> {
  await (await connection).from(table).insert(data);
}
