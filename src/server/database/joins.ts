import { RelationType } from "../../model";
import type { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { drop, from, insert } from "./queries";
import type { Joins, Tables } from "./types";
import { Table } from "./types";
import { ensureUserTransaction, rowFromLocation } from "./utils";

type List = Table.MediaAlbum | Table.MediaTag | Table.MediaPerson;

export const RELATION_TABLE: Record<RelationType, List> = {
  [RelationType.Album]: Table.MediaAlbum,
  [RelationType.Tag]: Table.MediaTag,
  [RelationType.Person]: Table.MediaPerson,
};

export const SOURCE_TABLE: Record<List, Table> = {
  [Table.MediaAlbum]: Table.Album,
  [Table.MediaTag]: Table.Tag,
  [Table.MediaPerson]: Table.Person,
};

export const ITEM_LINK: Record<List, string> = {
  [Table.MediaAlbum]: "album",
  [Table.MediaTag]: "tag",
  [Table.MediaPerson]: "person",
};

async function getCatalog(
  userDb: UserScopedConnection,
  table: Table,
  ids: string[],
): Promise<string> {
  await userDb.checkWrite(table, ids);

  let catalogs = await from(userDb.knex, table)
    .whereIn("id", ids)
    .distinct({
      catalog: "catalog",
    }) as { catalog: string }[];

  if (catalogs.length != 1) {
    throw new DatabaseError(
      DatabaseErrorCode.BadRequest,
      "Items from multiple catalogs were passed.",
    );
  }

  return catalogs[0].catalog;
}

export const addMediaRelations = ensureUserTransaction(
  async function addMediaRelations<T extends RelationType>(
    this: UserScopedConnection,
    relation: T,
    media: string[],
    relations: string[],
  ): Promise<Tables.MediaView[]> {
    if (media.length == 0) {
      return [];
    }

    let mediaCatalog = await getCatalog(this, Table.MediaInfo, media);

    if (relations.length == 0) {
      // We know that all of these exist so skip the type check.
      return this.getMedia(media) as Promise<Tables.MediaView[]>;
    }

    let table = RELATION_TABLE[relation];

    let relationCatalog = await getCatalog(this, SOURCE_TABLE[table], relations);

    if (mediaCatalog != relationCatalog) {
      throw new DatabaseError(
        DatabaseErrorCode.BadRequest,
        "addMediaRelations items should all be in the same catalog.",
      );
    }

    let inserts: unknown[] = [];
    for (let m of media) {
      for (let i of relations) {
        inserts.push({
          catalog: mediaCatalog,
          media: m,
          [ITEM_LINK[table]]: i,
        });
      }
    }

    // @ts-ignore
    let query = insert(this.knex, table, inserts);

    await this.connection.raw(`
      :query
      ON CONFLICT (:mediaRef:, :itemRef:) DO NOTHING
    `, {
      query,
      mediaRef: "media",
      itemRef: ITEM_LINK[table],
    });

    // We know that all of these exist so skip the type check.
    return this.getMedia(media) as Promise<Tables.MediaView[]>;
  },
);

export const removeMediaRelations = ensureUserTransaction(
  async function removeMediaRelations<T extends RelationType>(
    this: UserScopedConnection,
    relation: T,
    media: string[],
    relations: string[],
  ): Promise<Tables.MediaView[]> {
    if (media.length == 0) {
      return [];
    }

    let mediaCatalog = await getCatalog(this, Table.MediaInfo, media);

    if (relations.length == 0) {
      // We know that all of these exist so skip the type check.
      return this.getMedia(media) as Promise<Tables.MediaView[]>;
    }

    let table = RELATION_TABLE[relation];

    let relationCatalog = await getCatalog(this, SOURCE_TABLE[table], relations);

    if (mediaCatalog != relationCatalog) {
      throw new DatabaseError(
        DatabaseErrorCode.BadRequest,
        "removeMediaRelations items should all be in the same catalog.",
      );
    }

    await from(this.knex, table)
      .whereIn(`${table}.media`, media)
      .whereIn(`${table}.${ITEM_LINK[table]}`, relations)
      .delete();

    // We know that all of these exist so skip the type check.
    return this.getMedia(media) as Promise<Tables.MediaView[]>;
  },
);

export const setMediaRelations = ensureUserTransaction(
  async function setMediaRelations<T extends RelationType>(
    this: UserScopedConnection,
    relation: T,
    media: string[],
    relations: string[],
  ): Promise<Tables.MediaView[]> {
    if (!media.length) {
      return [];
    }

    let table = RELATION_TABLE[relation];

    if (relations.length == 0) {
      await this.checkWrite(Table.MediaInfo, media);

      await drop(this.knex, table)
        .whereIn("media", media);

      // We know that all of these exist so skip the type check.
      return this.getMedia(media) as Promise<Tables.MediaView[]>;
    }

    let mediaCatalog = await getCatalog(this, Table.MediaInfo, media);
    let relationCatalog = await getCatalog(this, SOURCE_TABLE[table], relations);

    if (mediaCatalog != relationCatalog) {
      throw new DatabaseError(
        DatabaseErrorCode.BadRequest,
        "setMediaRelations items should all be in the same catalog.",
      );
    }

    await drop(this.knex, table)
      .whereIn(`${table}.media`, media)
      .whereNotIn(`${table}.${ITEM_LINK[table]}`, relations);

    let inserts: unknown[] = [];
    for (let m of media) {
      for (let i of relations) {
        inserts.push({
          catalog: mediaCatalog,
          media: m,
          [ITEM_LINK[table]]: i,
        });
      }
    }

    // @ts-ignore
    let query = insert(this.knex, table, inserts);

    await this.connection.raw(`
      :query
      ON CONFLICT (:mediaRef:, :itemRef:) DO NOTHING
    `, {
      query,
      mediaRef: "media",
      itemRef: ITEM_LINK[table],
    });

    // We know that all of these exist so skip the type check.
    return this.getMedia(media) as Promise<Tables.MediaView[]>;
  },
);

export const setRelationMedia = ensureUserTransaction(
  async function setRelationMedia<T extends RelationType>(
    this: UserScopedConnection,
    relation: T,
    relations: string[],
    media: string[],
  ): Promise<Tables.MediaView[]> {
    let table = RELATION_TABLE[relation];

    if (media.length == 0) {
      await this.checkWrite(SOURCE_TABLE[table], relations);

      await drop(this.knex, table)
        .whereIn(ITEM_LINK[table], relations);

      return [];
    }

    let mediaCatalog = await getCatalog(this, Table.MediaInfo, media);

    if (!relations.length) {
      // We know that all of these exist so skip the type check.
      return this.getMedia(media) as Promise<Tables.MediaView[]>;
    }

    let relationCatalog = await getCatalog(this, SOURCE_TABLE[table], relations);

    if (mediaCatalog != relationCatalog) {
      throw new DatabaseError(
        DatabaseErrorCode.BadRequest,
        "setRelationMedia items should all be in the same catalog.",
      );
    }

    await drop(this.knex, table)
      .whereIn(`${table}.${ITEM_LINK[table]}`, relations)
      .whereNotIn(`${table}.media`, media);

    let inserts: unknown[] = [];
    for (let m of media) {
      for (let i of relations) {
        inserts.push({
          catalog: mediaCatalog,
          media: m,
          [ITEM_LINK[table]]: i,
        });
      }
    }

    // @ts-ignore
    let query = insert(this.knex, table, inserts);

    await this.connection.raw(`
      :query
      ON CONFLICT (:mediaRef:, :itemRef:) DO NOTHING
    `, {
      query,
      mediaRef: "media",
      itemRef: ITEM_LINK[table],
    });

    // We know that all of these exist so skip the type check.
    return this.getMedia(media) as Promise<Tables.MediaView[]>;
  },
);

export const setPersonLocations = ensureUserTransaction(async function setPersonLocations(
  this: UserScopedConnection,
  locations: Omit<Joins.MediaPerson, "catalog">[],
): Promise<Tables.MediaView[]> {
  if (locations.length == 0) {
    return [];
  }

  let people = locations.map(
    (location: Omit<Joins.MediaPerson, "catalog">): string => location.person,
  );
  let media = locations.map(
    (location: Omit<Joins.MediaPerson, "catalog">): string => location.media,
  );

  let mediaCatalog = await getCatalog(this, Table.MediaInfo, media);
  let personCatalog = await getCatalog(this, Table.Person, people);

  if (mediaCatalog != personCatalog) {
    throw new DatabaseError(
      DatabaseErrorCode.BadRequest,
      "setPersonLocations items should all be in the same catalog.",
    );
  }

  let inserts = locations.map((location: Omit<Joins.MediaPerson, "catalog">): unknown => ({
    catalog: mediaCatalog,
    media: location.media,
    person: location.person,
    location: rowFromLocation(this.knex, location.location),
  }));

  // @ts-ignore
  let query = insert(this.knex, Table.MediaPerson, inserts);

  await this.connection.raw(`
      :query
      ON CONFLICT (:mediaRef:, :personRef:) DO
        UPDATE SET :location: = :excludedLocation:
    `, {
    query,
    mediaRef: "media",
    personRef: "person",
    location: "location",
    excludedLocation: "excluded.location",
  });

  // We know that all of these exist so skip the type check.
  return this.getMedia(media) as Promise<Tables.MediaView[]>;
});
