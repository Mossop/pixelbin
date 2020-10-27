import type Knex from "knex";

import type { Search, Query } from "../../model";
import { checkQuery, isCompoundQuery, Join, Modifier, Operator } from "../../model";
import { isRelationQuery } from "../../model/search";
import { isDateTime } from "../../utils";
import type { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { uuid } from "./id";
import { ITEM_LINK, RELATION_TABLE, SOURCE_TABLE } from "./joins";
import { intoMedia } from "./media";
import { from, insert, withChildren } from "./queries";
import type { Media, Tables } from "./types";
import { intoAPITypes, intoDBType, intoDBTypes, ref, Table } from "./types";
import { ensureUserTransaction } from "./utils";

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

  let value = query.value;
  if (query.field == "taken" && !query.modifier && isDateTime(value)) {
    value = value.setZone("UTC", {
      keepLocalTime: true,
    });
  }

  let sql: string;
  switch (query.operator) {
    case Operator.Empty:
      sql = query.invert ? `${left} IS NOT NULL` : `${left} IS NULL`;
      break;
    case Operator.Equal:
      sql = query.invert ? `${left} IS DISTINCT FROM ?` : `${left} IS NOT DISTINCT FROM ?`;
      bindings.push(intoDBType(value));
      break;
    case Operator.LessThan:
      sql = query.invert ? `${left} >= ?` : `${left} < ?`;
      bindings.push(intoDBType(value));
      break;
    case Operator.LessThanOrEqual:
      sql = query.invert ? `${left} > ?` : `${left} <= ?`;
      bindings.push(intoDBType(value));
      break;
    case Operator.Contains:
      sql = query.invert ? `(${left} NOT LIKE ? OR ?? IS NULL)` : `${left} LIKE ?`;
      bindings.push(`%${escape(value)}%`);
      if (query.invert) {
        bindings.push(fieldReference);
      }
      break;
    case Operator.StartsWith:
      sql = query.invert ? `(${left} NOT LIKE ? OR ?? IS NULL)` : `${left} LIKE ?`;
      bindings.push(`${escape(value)}%`);
      if (query.invert) {
        bindings.push(fieldReference);
      }
      break;
    case Operator.EndsWith:
      sql = query.invert ? `(${left} NOT LIKE ? OR ?? IS NULL)` : `${left} LIKE ?`;
      bindings.push(`%${escape(value)}`);
      if (query.invert) {
        bindings.push(fieldReference);
      }
      break;
    case Operator.Matches:
      sql = query.invert ? `(${left} !~ ? OR ?? IS NULL)` : `${left} ~ ?`;
      bindings.push(intoDBType(value));
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
      // @ts-ignore
      return (...args: unknown[]) => builder.andWhereNot(...args);
    } else {
      // @ts-ignore
      return (...args: unknown[]) => builder.andWhere(...args);
    }
  } else if (invert) {
    // @ts-ignore
    return (...args: unknown[]) => builder.orWhereNot(...args);
  } else {
    // @ts-ignore
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
        // @ts-ignore
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
    .select<Tables.StoredMediaDetail[]>(ref(Table.StoredMediaDetail));

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

export const createSavedSearch = ensureUserTransaction(async function saveSavedSearch(
  this: UserScopedConnection,
  data: Omit<Tables.SavedSearch, "id">,
): Promise<Tables.SavedSearch> {
  await this.checkWrite(Table.Catalog, [data.catalog]);

  let results = await insert(this.knex, Table.SavedSearch, {
    ...intoDBTypes(data),
    id: await uuid("S"),
  }).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert SavedSearch record.");
  }

  return intoAPITypes(results[0]);
});

export const deleteSavedSearch = ensureUserTransaction(async function deleteSavedSearch(
  this: UserScopedConnection,
  id: string,
): Promise<void> {
  await this.checkWrite(Table.SavedSearch, [id]);

  await from(this.knex, Table.SavedSearch)
    .where(ref(Table.SavedSearch, "id"), id)
    .del();
});

export async function listSavedSearches(
  this: UserScopedConnection,
): Promise<Tables.SavedSearch[]> {
  let results = await from(this.knex, Table.SavedSearch)
    .innerJoin(
      Table.UserCatalog,
      ref(Table.UserCatalog, "catalog"),
      ref(Table.SavedSearch, "catalog"),
    )
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.SavedSearch[]>(ref(Table.SavedSearch));
  return results.map(intoAPITypes);
}
