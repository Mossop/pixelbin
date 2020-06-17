import * as JoinTypes from "./joins";
import { RecordFor } from "./meta";
import * as TableTypes from "./tables";

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
  [Table.User]: TableTypes.User;
  [Table.Catalog]: TableTypes.Catalog;
  [Table.Album]: TableTypes.Album;
  [Table.Tag]: TableTypes.Tag;
  [Table.Person]: TableTypes.Person;
  [Table.Media]: TableTypes.Media;
  [Table.MediaInfo]: TableTypes.MediaInfo;

  [Table.UserCatalog]: JoinTypes.UserCatalog;
  [Table.MediaAlbum]: JoinTypes.MediaAlbum;
  [Table.MediaTag]: JoinTypes.MediaTag;
  [Table.MediaPerson]: JoinTypes.MediaPerson;
}

export type TableType<T extends Table> = TableMapping[T];

export type TableRecord<T extends Table> = RecordFor<TableType<T>>;
