import { ForeignKey } from "./meta";
import * as Table from "./tables";

export interface UserCatalog {
  user: ForeignKey<Table.User>;
  catalog: ForeignKey<Table.Catalog>;
}

export interface MediaAlbum {
  media: ForeignKey<Table.Media>;
  album: ForeignKey<Table.Album>;
}

export interface MediaTag {
  media: ForeignKey<Table.Media>;
  tag: ForeignKey<Table.Tag>;
}

export interface MediaPerson {
  media: ForeignKey<Table.Media>;
  tag: ForeignKey<Table.Tag>;
}
