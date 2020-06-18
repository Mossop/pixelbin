import * as Joins from "./joins";
import { RecordFor } from "./meta";
import * as Tables from "./tables";

export { Joins, Tables };
export type { RecordFor };

export enum Table {
  User = "user",
  Catalog = "catalog",
  Album = "album",
  Tag = "tag",
  Person = "person",
  Media = "media",
  MediaInfo = "mediaInfo",

  UserCatalog = "user_catalog",
  MediaAlbum = "media_album",
  MediaTag = "media_tag",
  MediaPerson = "media_person",
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

export type TableType<T extends Table> = TableMapping[T];

export type TableRecord<T extends Table> = RecordFor<TableType<T>>;
