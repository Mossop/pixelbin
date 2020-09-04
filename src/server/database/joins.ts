import Knex from "knex";

import { Api } from "../../model";
import { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { from, insertFromSelect } from "./queries";
import { ref, Table } from "./types";
import { rowFromLocation } from "./utils";

type List = Table.MediaAlbum | Table.MediaTag | Table.MediaPerson;

const RELATION_TABLE: Record<Api.RelationType, List> = {
  [Api.RelationType.Album]: Table.MediaAlbum,
  [Api.RelationType.Tag]: Table.MediaTag,
  [Api.RelationType.Person]: Table.MediaPerson,
};

const SOURCE_TABLE: Record<List, Table> = {
  [Table.MediaAlbum]: Table.Album,
  [Table.MediaTag]: Table.Tag,
  [Table.MediaPerson]: Table.Person,
};

const ITEM_LINK: Record<List, string> = {
  [Table.MediaAlbum]: "album",
  [Table.MediaTag]: "tag",
  [Table.MediaPerson]: "person",
};

type Updated<T extends Api.RelationType> =
  T extends Api.RelationType.Album
    ? { media: string; album: string; }
    : T extends Api.RelationType.Tag
      ? { media: string; tag: string; }
      : { media: string; person: string; };

export async function addMediaRelations<T extends Api.RelationType>(
  this: UserScopedConnection,
  relation: T,
  media: string[],
  items: string[],
): Promise<Updated<T>[]> {
  let table = RELATION_TABLE[relation];

  // Use a transaction so we can rollback the change if it didn't affect the expected number
  // of rows.
  return this.inTransaction(async (userDb: UserScopedConnection): Promise<Updated<T>[]> => {
    let select = from(userDb.knex, Table.UserCatalog)
      .join(
        SOURCE_TABLE[table],
        ref(Table.UserCatalog, "catalog"),
        `${SOURCE_TABLE[table]}.catalog`,
      )
      .join(Table.Media, ref(Table.UserCatalog, "catalog"), ref(Table.Media, "catalog"))
      .whereIn(ref(Table.Media, "id"), media)
      .whereIn(`${SOURCE_TABLE[table]}.id`, items)
      .where(ref(Table.UserCatalog, "user"), userDb.user);

    // @ts-ignore: Can't figure out the computed property.
    let insert = insertFromSelect(userDb.knex, table, select, {
      catalog: userDb.connection.ref(ref(Table.UserCatalog, "catalog")),
      media: userDb.connection.ref(ref(Table.Media, "id")),
      [ITEM_LINK[table]]: userDb.connection.ref(`${SOURCE_TABLE[table]}.id`),
    });

    /**
     * The update on conflict here is a no-op to allow returning the rows that
     * were already present but unaltered.
     */
    let results = await userDb.connection.raw(`
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
      media: userDb.connection.ref(`${table}.media`),
      item: userDb.connection.ref(`${table}.${ITEM_LINK[table]}`),
    });

    let rows = (results.rows ?? []) as Updated<T>[];

    if (rows.length != media.length * items.length) {
      throw new DatabaseError(DatabaseErrorCode.MissingRelationship, "Unknown items passed.");
    }

    return rows;
  });
}

export async function removeMediaRelations<T extends Api.RelationType>(
  this: UserScopedConnection,
  relation: T,
  media: string[],
  items: string[],
): Promise<void> {
  let table = RELATION_TABLE[relation];

  let catalogs = from(this.knex, Table.UserCatalog)
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select("catalog");

  await from(this.knex, table)
    .whereIn(`${table}.catalog`, catalogs)
    .whereIn(`${table}.media`, media)
    .whereIn(`${table}.${ITEM_LINK[table]}`, items)
    .delete();
}

export async function setMediaRelations<T extends Api.RelationType>(
  this: UserScopedConnection,
  relation: T,
  media: string[],
  relations: string[],
): Promise<Updated<T>[]> {
  if (!media.length) {
    return [];
  }

  let table = RELATION_TABLE[relation];

  const catalogQuery = (userDb: UserScopedConnection): Knex.QueryBuilder => {
    return from(userDb.knex, Table.UserCatalog)
      .where(ref(Table.UserCatalog, "user"), userDb.user)
      .select("catalog");
  };

  if (relations.length == 0) {
    await from(this.knex, table)
      .whereIn(`${table}.catalog`, catalogQuery(this))
      .whereIn(`${table}.media`, media)
      .delete();

    return [];
  }

  return this.inTransaction(async (userConnection: UserScopedConnection): Promise<Updated<T>[]> => {
    await from(this.knex, table)
      .whereIn(`${table}.catalog`, catalogQuery(this))
      .whereIn(`${table}.media`, media)
      .whereNotIn(`${table}.${ITEM_LINK[table]}`, relations)
      .delete();

    return userConnection.addMediaRelations(relation, media, relations);
  });
}

export async function setRelationMedia<T extends Api.RelationType>(
  this: UserScopedConnection,
  relation: T,
  relations: string[],
  media: string[],
): Promise<Updated<T>[]> {
  if (!relations.length) {
    return [];
  }

  let table = RELATION_TABLE[relation];

  const catalogQuery = (userDb: UserScopedConnection): Knex.QueryBuilder => {
    return from(userDb.knex, Table.UserCatalog)
      .where(ref(Table.UserCatalog, "user"), userDb.user)
      .select("catalog");
  };

  if (media.length == 0) {
    await from(this.knex, table)
      .whereIn(`${table}.catalog`, catalogQuery(this))
      .whereIn(`${table}.${ITEM_LINK[table]}`, relations)
      .delete();

    return [];
  }

  return this.inTransaction(async (userConnection: UserScopedConnection): Promise<Updated<T>[]> => {
    await from(this.knex, table)
      .whereIn(`${table}.catalog`, catalogQuery(this))
      .whereIn(`${table}.${ITEM_LINK[table]}`, relations)
      .whereNotIn(`${table}.media`, media)
      .delete();

    return userConnection.addMediaRelations(relation, media, relations);
  });
}

export async function setPersonLocations(
  this: UserScopedConnection,
  locations: Api.MediaPersonLocation[],
): Promise<void> {
  let bindings: Knex.RawBinding[] = [];
  for (let location of locations) {
    bindings.push(location.media, location.person, rowFromLocation(this.knex, location.location));
  }

  let values: string[] = [];
  values.length = locations.length;
  values.fill("(?, ?, ?)");
  bindings.push("Location", "media", "person", "location");

  let catalogs = from(this.knex, Table.UserCatalog)
    .where({
      user: this.user,
    })
    .as("Catalogs");

  let select = from(this.knex, Table.Media)
    .rightJoin(
      this.connection.raw(`(VALUES ${values.join(",")}) AS ?? (??, ??, ??)`, bindings),
      ref(Table.Media, "id"),
      "Location.media",
    )
    .leftJoin(catalogs, "Catalogs.catalog", ref(Table.Media, "catalog"));

  let insert = insertFromSelect(this.knex, Table.MediaPerson, select, {
    catalog: this.ref("Catalogs.catalog"),
    media: this.ref(ref(Table.Media, "id")),
    person: this.ref("Location.person"),
    location: this.ref("Location.location"),
  });

  await this.connection.raw(`
      :insert
      ON CONFLICT (:mediaRef:, :personRef:) DO
        UPDATE SET :location: = :excludedLocation:
    `, {
    insert,
    mediaRef: "media",
    personRef: "person",
    location: "location",
    excludedLocation: "excluded.location",
  });
}
