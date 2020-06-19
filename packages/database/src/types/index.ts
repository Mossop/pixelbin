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

export function ref<
  T extends Table,
  K extends keyof TableRecord<T>
>(table: T, column?: K): string {
  return `${table}.${column ?? "*"}`;
}
