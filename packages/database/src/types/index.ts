import * as Joins from "./joins";
import * as Tables from "./tables";

export { Joins, Tables };

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

export type TableRecord<T extends Table> = TableMapping[T];
