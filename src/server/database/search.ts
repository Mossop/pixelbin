import Knex from "knex";

import { checkQuery, isCompoundQuery, Join, Modifier, Operator, Search, Query } from "../../model";
import { isRelationQuery } from "../../model/search";
import { UserScopedConnection } from "./connection";
import { ITEM_LINK, RELATION_TABLE, SOURCE_TABLE } from "./joins";
import { intoMedia } from "./media";
import { from, withChildren } from "./queries";
import { intoDBType, Media, ref, Table, Tables } from "./types";

function escape(value: unknown): string {
  return String(value);
}

function applyFieldQuery(
  connection: UserScopedConnection,
  builder: Knex.QueryBuilder,
  table: Table,
  join: Join,
  query: Search.FieldQuery,
): Knex.QueryBuilder {
  let fieldReference = `${table}.${query.field}`;
  let bindings: Knex.RawBinding[] = [fieldReference];
  let left = "??";

  if (query.modifier) {
    switch (query.modifier) {
      case Modifier.Length:
        left = "char_length(??)";
        break;
      case Modifier.Year:
        left = "EXTRACT(YEAR FROM ??)";
        break;
      case Modifier.Month:
        left = "EXTRACT(MONTH FROM ??)";
        break;
    }
  }

  let sql: string;
  switch (query.operator) {
    case Operator.Empty:
      sql = query.invert ? `${left} IS NOT NULL` : `${left} IS NULL`;
      break;
    case Operator.Equal:
      sql = query.invert ? `${left} IS DISTINCT FROM ?` : `${left} IS NOT DISTINCT FROM ?`;
      bindings.push(intoDBType(query.value));
      break;
    case Operator.LessThan:
      sql = query.invert ? `${left} >= ?` : `${left} < ?`;
      bindings.push(intoDBType(query.value));
      break;
    case Operator.LessThanOrEqual:
      sql = query.invert ? `${left} > ?` : `${left} <= ?`;
      bindings.push(intoDBType(query.value));
      break;
    case Operator.Contains:
      sql = query.invert ? `(${left} NOT LIKE ? OR ?? IS NULL)` : `${left} LIKE ?`;
      bindings.push(`%${escape(query.value)}%`);
      if (query.invert) {
        bindings.push(fieldReference);
      }
      break;
    case Operator.StartsWith:
      sql = query.invert ? `(${left} NOT LIKE ? OR ?? IS NULL)` : `${left} LIKE ?`;
      bindings.push(`${escape(query.value)}%`);
      if (query.invert) {
        bindings.push(fieldReference);
      }
      break;
    case Operator.EndsWith:
      sql = query.invert ? `(${left} NOT LIKE ? OR ?? IS NULL)` : `${left} LIKE ?`;
      bindings.push(`%${escape(query.value)}`);
      if (query.invert) {
        bindings.push(fieldReference);
      }
      break;
    case Operator.Matches:
      sql = query.invert ? `(${left} !~ ? OR ?? IS NULL)` : `${left} ~ ?`;
      bindings.push(intoDBType(query.value));
      if (query.invert) {
        bindings.push(fieldReference);
      }
      break;
  }

  return where(builder, join, false)(connection.raw(sql, bindings));
}

function where(builder: Knex.QueryBuilder, join: Join, invert: boolean): Knex.Where {
  if (join == Join.And) {
    if (invert) {
      // @ts-ignore: Nope
      return (...args: unknown[]) => builder.andWhereNot(...args);
    } else {
      // @ts-ignore: Nope
      return (...args: unknown[]) => builder.andWhere(...args);
    }
  } else if (invert) {
    // @ts-ignore: Nope
    return (...args: unknown[]) => builder.orWhereNot(...args);
  } else {
    // @ts-ignore: Nope
    return (...args: unknown[]) => builder.orWhere(...args);
  }
}

function applyQuery(
  connection: UserScopedConnection,
  builder: Knex.QueryBuilder,
  catalog: string,
  currentTable: Table,
  currentJoin: Join,
  query: Search.Query,
): Knex.QueryBuilder {
  if (isCompoundQuery(query)) {
    if (isRelationQuery(query)) {
      let relationTable = RELATION_TABLE[query.relation];
      let newTable = SOURCE_TABLE[relationTable];
      let link = ITEM_LINK[relationTable];

      let selected = from(connection.knex, newTable)
        .where(`${newTable}.catalog`, catalog)
        .andWhere((builder: Knex.QueryBuilder): void => {
          for (let q of query.queries) {
            builder = applyQuery(connection, builder, catalog, newTable, query.join, q);
          }
        });

      if (query.recursive && (newTable == Table.Album || newTable == Table.Tag)) {
        // @ts-ignore: Too dynamic.
        selected = withChildren(connection.knex, newTable, selected);
      }

      let media = from(connection.knex, relationTable)
        .join(selected.as("Selected"), "Selected.id", `${relationTable}.${link}`)
        .select(`${relationTable}.media`);

      if (currentJoin == Join.And) {
        if (query.invert) {
          return builder.whereNotIn(`${currentTable}.id`, media);
        } else {
          return builder.whereIn(`${currentTable}.id`, media);
        }
      } else if (query.invert) {
        return builder.orWhereNotIn(`${currentTable}.id`, media);
      } else {
        return builder.orWhereIn(`${currentTable}.id`, media);
      }
    } else {
      return where(builder, currentJoin, query.invert)((builder: Knex.QueryBuilder): void => {
        for (let q of query.queries) {
          builder = applyQuery(connection, builder, catalog, currentTable, query.join, q);
        }
      });
    }
  } else {
    return applyFieldQuery(connection, builder, currentTable, currentJoin, query);
  }
}

export async function searchMedia(
  this: UserScopedConnection,
  catalog: string,
  search: Query,
): Promise<Media[]> {
  checkQuery(search);

  let builder = from(this.knex, Table.StoredMediaDetail)
    .join(
      Table.UserCatalog,
      ref(Table.UserCatalog, "catalog"),
      ref(Table.StoredMediaDetail, "catalog"),
    )
    .where(ref(Table.UserCatalog, "user"), this.user)
    .andWhere(ref(Table.UserCatalog, "catalog"), catalog)
    .select<Tables.StoredMedia[]>(ref(Table.StoredMediaDetail));

  builder = applyQuery(
    this,
    builder,
    catalog,
    Table.StoredMediaDetail,
    Join.And,
    search,
  );

  return (await builder).map(intoMedia);
}
