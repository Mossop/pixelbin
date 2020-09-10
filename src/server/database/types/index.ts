import Knex from "knex";

import { ObjectModel } from "../../../model";
import { Obj } from "../../../utils";
import * as Joins from "./joins";
import * as Tables from "./tables";

export { Joins, Tables };

export * from "./constraints";
export * from "./meta";

export enum Table {
  User = "User",
  Storage = "Storage",
  Catalog = "Catalog",
  Album = "Album",
  Tag = "Tag",
  Person = "Person",
  Media = "Media",
  Original = "Original",
  AlternateFile = "AlternateFile",

  SharedCatalog = "Shared_Catalog",
  MediaAlbum = "Media_Album",
  MediaTag = "Media_Tag",
  MediaPerson = "Media_Person",

  // Not real tables.
  StoredMedia = "StoredMedia",
  StoredMediaDetail = "StoredMediaDetail",
  UserCatalog = "UserCatalog",
}

export interface TableMapping {
  [Table.User]: Tables.User;
  [Table.Storage]: Tables.Storage;
  [Table.Catalog]: Tables.Catalog;
  [Table.Album]: Tables.Album;
  [Table.Tag]: Tables.Tag;
  [Table.Person]: Tables.Person;
  [Table.Media]: Tables.Media;
  [Table.Original]: Tables.Original;
  [Table.AlternateFile]: Tables.AlternateFile;

  [Table.SharedCatalog]: Joins.SharedCatalog;
  [Table.MediaAlbum]: Joins.MediaAlbum;
  [Table.MediaTag]: Joins.MediaTag;
  [Table.MediaPerson]: Joins.MediaPerson;

  [Table.StoredMedia]: Tables.StoredMedia;
  [Table.StoredMediaDetail]: Tables.StoredMedia;
  [Table.UserCatalog]: Joins.UserCatalog;
}

export type TableRecord<T extends Table> = TableMapping[T];

export type UserRef = Tables.User["email"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ref<T extends Table = any> = Knex.Ref<T, TableRecord<T>>;

export function ref<
  T extends Table,
>(table: T, column?: keyof TableRecord<T>): string {
  return `${table}.${column ?? "*"}`;
}

export function isRef<T extends Table>(ref: Obj | null): ref is Ref<T> {
  if (!ref) {
    return false;
  }

  return ref.constructor.name == "Ref";
}

export function bindingParam(val: Knex.RawBinding | Ref): string {
  return val && isRef(val) ? "??" : "?";
}

export const COLUMNS = {
  [Table.Media]: [
    "id",
    "catalog",
    "created",
    ...ObjectModel.metadataColumns,
  ],
};

export type UnprocessedMedia = ObjectModel.UnprocessedMedia;
export type ProcessedMedia = ObjectModel.ProcessedMedia & {
  original: string;
  fileName: string;
};
export type Media = UnprocessedMedia | ProcessedMedia;