import type Knex from "knex";

import type {
  Table,
  TableRecord,
  WithRefs,
  QueryBuilder,
} from "./types";
import {
  ref,
  intoDBTypes,
} from "./types";

export function drop<T extends Table>(
  knex: Knex,
  table: T,
): Knex.QueryBuilder<TableRecord<T>, void> {
  return knex<TableRecord<T>>(table).delete();
}

export function withChildren<T extends Table.Tag | Table.Album>(
  knex: Knex,
  table: T,
  queryBuilder: QueryBuilder<TableRecord<T>>,
): QueryBuilder<TableRecord<T>> {
  // @ts-ignore
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

export function withParents<T extends Table.Tag | Table.Album>(
  knex: Knex,
  table: T,
  queryBuilder: QueryBuilder<TableRecord<T>>,
): QueryBuilder<TableRecord<T>> {
  // @ts-ignore
  return knex.withRecursive(
    "children",
    queryBuilder.select(ref(table)).union((qb: Knex.QueryBuilder): void => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      qb.from<TableRecord<T>>(table)
        .select(`${table}.*`)
        .join("children", "children.parent", `${table}.id`);
    }),
  ).from("children");
}

export function update<T extends Table>(
  table: T,
  query: Knex.QueryInterface,
  columns: WithRefs<Partial<TableRecord<T>>>,
): Knex.QueryBuilder<TableRecord<T>, number> {
  // @ts-ignore
  return query.into<TableRecord<T>>(table).update(intoDBTypes(columns));
}

export function from<T extends Table>(
  knex: Knex.QueryInterface,
  tableName: T,
): QueryBuilder<TableRecord<T>> {
  return knex.table(tableName) as QueryBuilder<TableRecord<T>>;
}

export const into = from;
export const table = from;

export function insert<T extends Table>(
  knex: Knex,
  table: T,
  data: WithRefs<TableRecord<T>> | WithRefs<TableRecord<T>>[],
): QueryBuilder<TableRecord<T>> {
  // @ts-ignore
  let dbData: TableRecord<T>[] = (Array.isArray(data) ? data : [data]).map(intoDBTypes);
  // @ts-ignore
  return knex<TableRecord<T>>(table).insert(dbData) as QueryBuilder<TableRecord<T>>;
}
