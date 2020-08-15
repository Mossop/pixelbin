import Knex from "knex";

import { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { from, insertFromSelect } from "./queries";
import { ref, Table } from "./types";

type List = Table.MediaAlbum | Table.MediaTag | Table.MediaPerson;

const TABLE_LINK = {
  [Table.MediaAlbum]: Table.Album,
  [Table.MediaTag]: Table.Tag,
  [Table.MediaPerson]: Table.Person,
};

const ITEM_LINK = {
  [Table.MediaAlbum]: "album",
  [Table.MediaTag]: "tag",
  [Table.MediaPerson]: "person",
};

type Updated<T extends List> =
  T extends Table.MediaAlbum
    ? { media: string; album: string; }
    : T extends Table.MediaTag
      ? { media: string; tag: string; }
      : { media: string; person: string; };

export async function addMedia<T extends List>(
  this: UserScopedConnection,
  table: T,
  media: string[],
  items: string[],
): Promise<Updated<T>[]> {
  // Use a transaction so we can rollback the change if it didn't affect the expected number
  // of rows.
  return this.inTransaction(async (connection: UserScopedConnection): Promise<Updated<T>[]> => {
    let select = from(connection.knex, Table.UserCatalog)
      .join(TABLE_LINK[table], ref(Table.UserCatalog, "catalog"), `${TABLE_LINK[table]}.catalog`)
      .join(Table.Media, ref(Table.UserCatalog, "catalog"), ref(Table.Media, "catalog"))
      .whereIn(ref(Table.Media, "id"), media)
      .whereIn(`${TABLE_LINK[table]}.id`, items)
      .where(ref(Table.UserCatalog, "user"), connection.user);

    let insert = insertFromSelect(connection.knex, table, select, {
    // @ts-ignore: TypeScript cannot infer that catalog is a shared column.
      catalog: connection.connection.ref(ref(Table.UserCatalog, "catalog")),
      media: connection.connection.ref(ref(Table.Media, "id")),
      [ITEM_LINK[table]]: connection.connection.ref(`${TABLE_LINK[table]}.id`),
    });

    /**
     * The update on conflict here is a no-op to allow returning the rows that
     * were already present but unaltered.
     */
    let results = await connection.connection.raw(`
    :insert
    ON CONFLICT (:mediaRef:, :itemRef:) DO
      UPDATE SET :catalog: = :excludedCatalog:
    RETURNING :media, :item
  `, {
      insert,
      mediaRef: "media",
      itemRef: ITEM_LINK[table],
      catalog: "catalog",
      excludedCatalog: "excluded.catalog",
      media: connection.connection.ref(`${table}.media`),
      item: connection.connection.ref(`${table}.${ITEM_LINK[table]}`),
    });

    let rows = (results.rows ?? []) as Updated<T>[];

    if (rows.length != media.length * items.length) {
      throw new DatabaseError(DatabaseErrorCode.MissingRelationship, "Unknown items passed.");
    }

    return rows;
  });
}

export async function removeMedia<T extends List>(
  this: UserScopedConnection,
  table: T,
  media: string[],
  items: string[],
): Promise<void> {
  let catalogs = from(this.knex, Table.UserCatalog)
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select("catalog");

  await from(this.knex, table)
    .whereIn(`${table}.catalog`, catalogs)
    .whereIn(`${table}.media`, media)
    .whereIn(`${table}.${ITEM_LINK[table]}`, items)
    .delete();
}

export async function setMedia<T extends List>(
  this: UserScopedConnection,
  table: T,
  media: string[],
  items: string[],
): Promise<Updated<T>[]> {
  if (!media.length && !items.length) {
    return [];
  }

  const catalogQuery = (userDb: UserScopedConnection): Knex.QueryBuilder => {
    return from(userDb.knex, Table.UserCatalog)
      .where(ref(Table.UserCatalog, "user"), userDb.user)
      .select("catalog");
  };

  if (media.length == 0) {
    await from(this.knex, table)
      .whereIn(`${table}.catalog`, catalogQuery(this))
      .whereIn(`${table}.${ITEM_LINK[table]}`, items)
      .delete();

    return [];
  } else if (items.length == 0) {
    await from(this.knex, table)
      .whereIn(`${table}.catalog`, catalogQuery(this))
      .whereIn(`${table}.media`, media)
      .delete();

    return [];
  }

  return this.inTransaction(async (userConnection: UserScopedConnection): Promise<Updated<T>[]> => {
    await from(userConnection.knex, table)
      .whereIn(`${table}.catalog`, catalogQuery(userConnection))
      .where((builder: Knex.QueryBuilder) => {
        void builder.where((builder: Knex.QueryBuilder) => {
          void builder.whereIn(`${table}.${ITEM_LINK[table]}`, items)
            .whereNotIn(`${table}.media`, media);
        }).orWhere((builder: Knex.QueryBuilder) => {
          void builder.whereNotIn(`${table}.${ITEM_LINK[table]}`, items)
            .whereIn(`${table}.media`, media);
        });
      })
      .delete();

    return userConnection.addMedia(table, media, items);
  });
}
