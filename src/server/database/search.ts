import type Knex from "knex";

import type { Search, Query, ObjectModel } from "../../model";
import { checkQuery, isCompoundQuery, Join, Modifier, Operator } from "../../model";
import { isRelationQuery } from "../../model/search";
import { isDateTime, Level } from "../../utils";
import type { DatabaseConnection, UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode, notfound } from "./error";
import { searchId } from "./id";
import { ITEM_LINK, RELATION_TABLE, SOURCE_TABLE } from "./joins";
import type { MediaView } from "./mediaview";
import { mediaView } from "./mediaview";
import { from, insert, update, withChildren } from "./queries";
import type { Tables } from "./types";
import { applyTimeZoneFields, intoDBType, intoDBTypes, ref, Table } from "./types";
import { deleteFields, ensureUserTransaction } from "./utils";

function escape(value: unknown): string {
  return String(value);
}

function applyFieldQuery(
  knex: Knex,
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

  return where(builder, join, false)(knex.raw(sql, bindings));
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
  knex: Knex,
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

      let selected = from(knex, newTable)
        .where(`${newTable}.catalog`, catalog)
        .andWhere((builder: Knex.QueryBuilder): void => {
          for (let q of query.queries) {
            builder = applyQuery(knex, builder, catalog, newTable, query.join, q);
          }
        });

      if (query.recursive && (newTable == Table.Album || newTable == Table.Tag)) {
        // @ts-ignore
        selected = withChildren(knex, newTable, selected).from("parents");
      }

      let media = from(knex, relationTable)
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
          builder = applyQuery(knex, builder, catalog, currentTable, query.join, q);
        }
      });
    }
  } else {
    return applyFieldQuery(knex, builder, currentTable, currentJoin, query);
  }
}

function buildSearch(
  knex: Knex,
  catalog: string,
  query: Query,
): Knex.QueryBuilder<MediaView, MediaView[]> {
  checkQuery(query);

  let builder = mediaView(knex)
    .where(ref(Table.MediaView, "catalog"), catalog);

  return applyQuery(
    knex,
    builder,
    catalog,
    Table.MediaView,
    Join.And,
    query,
  ) as Knex.QueryBuilder<MediaView, MediaView[]>;
}

interface SharedSearch {
  name: string;
  query: Knex.QueryBuilder<MediaView, MediaView[]>;
}

export async function getSharedSearch(
  this: DatabaseConnection,
  search: string,
): Promise<SharedSearch> {
  if (!this.isInTransaction) {
    throw new Error("getSharedSearch reqires a transaction to operate safely.");
  }

  let savedSearches = await from(this.knex, Table.SavedSearch)
    .where({
      [ref(Table.SavedSearch, "id")]: search,
      [ref(Table.SavedSearch, "shared")]: true,
    });

  if (savedSearches.length != 1) {
    notfound(Table.SavedSearch);
  }

  let { name, catalog, query } = savedSearches[0];

  return {
    name,
    query: buildSearch(this.knex, catalog, query),
  };
}

export async function searchMedia(
  this: UserScopedConnection,
  catalog: string,
  search: Query,
): Promise<MediaView[]> {
  return this.logger.child("searchMedia").timeLonger(async () => {
    await this.checkRead(Table.Catalog, [catalog]);

    let media = await buildSearch(this.knex, catalog, search)
      .select<MediaView[]>(ref(Table.MediaView));

    return media.map(applyTimeZoneFields);
  }, Level.Trace, 250, "Completed media search");
}

export const createSavedSearch = ensureUserTransaction(async function saveSavedSearch(
  this: UserScopedConnection,
  catalog: ObjectModel.Catalog["id"],
  data: Omit<ObjectModel.SavedSearch, "id">,
): Promise<Tables.SavedSearch> {
  await this.checkWrite(Table.Catalog, [catalog]);

  let results = await insert(this.knex, Table.SavedSearch, {
    ...intoDBTypes(data),
    id: await searchId(),
    catalog,
  }).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert SavedSearch record.");
  }

  return results[0];
});

export const editSavedSearch = ensureUserTransaction(async function editSavedSearch(
  this: UserScopedConnection,
  id: string,
  data: Partial<Omit<ObjectModel.SavedSearch, "id">>,
): Promise<Tables.SavedSearch> {
  await this.checkWrite(Table.SavedSearch, [id]);

  let updates = deleteFields(data, [
    "id",
    "catalog",
  ]);

  let results = await update(
    Table.SavedSearch,
    this.knex.where("id", id),
    updates,
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit SavedSearch record.");
  }

  return results[0];
});

export const deleteSavedSearches = ensureUserTransaction(async function deleteSavedSearches(
  this: UserScopedConnection,
  ids: string[],
): Promise<void> {
  await this.checkWrite(Table.SavedSearch, ids);

  await from(this.knex, Table.SavedSearch)
    .whereIn(ref(Table.SavedSearch, "id"), ids)
    .del();
});

export async function listSavedSearches(
  this: UserScopedConnection,
): Promise<Tables.SavedSearch[]> {
  return from(this.knex, Table.SavedSearch)
    .innerJoin(
      Table.UserCatalog,
      ref(Table.UserCatalog, "catalog"),
      ref(Table.SavedSearch, "catalog"),
    )
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.SavedSearch[]>(ref(Table.SavedSearch));
}

export interface SharedSearchResults {
  name: string;
  media: MediaView[];
}

export async function sharedSearch(
  this: DatabaseConnection,
  search: string,
): Promise<SharedSearchResults> {
  return this.inTransaction(
    async function sharedSearch(db: DatabaseConnection): Promise<SharedSearchResults> {
      let { name, query } = await db.getSharedSearch(search);
      let media = await query.select<MediaView[]>(ref(Table.MediaView));

      return {
        name,
        media: media.map(applyTimeZoneFields),
      };
    },
  );
}
