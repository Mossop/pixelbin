import Knex from "knex";
import { Obj } from "pixelbin-utils";

import * as Joins from "./joins";
import * as Tables from "./tables";

export { Joins, Tables };

export enum Table {
  User = "User",
  Catalog = "Catalog",
  Album = "Album",
  Tag = "Tag",
  Person = "Person",
  Media = "Media",
  MediaInfo = "MediaInfo",

  UserCatalog = "User_Catalog",
  MediaAlbum = "Media_Album",
  MediaTag = "Media_Tag",
  MediaPerson = "Media_Person",
}

export interface TableMapping {
  [Table.User]: Tables.User;
  [Table.Catalog]: Tables.Catalog;
  [Table.Album]: Tables.Album;
  [Table.Tag]: Tables.Tag;
  [Table.Person]: Tables.Person;
  [Table.Media]: Tables.Media;
  [Table.MediaInfo]: Tables.MediaInfo;

  [Table.UserCatalog]: Joins.UserCatalog;
  [Table.MediaAlbum]: Joins.MediaAlbum;
  [Table.MediaTag]: Joins.MediaTag;
  [Table.MediaPerson]: Joins.MediaPerson;
}

export type TableRecord<T extends Table> = TableMapping[T];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ref<T extends Table = any> = Knex.Ref<T, TableRecord<T>>;

export function ref<
  T extends Table,
  K extends keyof TableRecord<T>
>(table: T, column?: K): string {
  return `${table}.${column ?? "*"}`;
}

export function isRef<T extends Table>(ref: Obj): ref is Ref<T> {
  if (!ref) {
    return false;
  }

  return ref.constructor.name == "Ref";
}
