import { ForeignKey } from "./tables";
import * as Table from "./tables";

export interface UserCatalog {
  user: ForeignKey<Table.UserData>;
  catalog: ForeignKey<Table.CatalogData>;
}

export interface MediaAlbum {
  media: ForeignKey<Table.MediaData>;
  album: ForeignKey<Table.AlbumData>;
}

export interface MediaTag {
  media: ForeignKey<Table.MediaData>;
  tag: ForeignKey<Table.TagData>;
}

export interface MediaPerson {
  media: ForeignKey<Table.MediaData>;
  tag: ForeignKey<Table.TagData>;
}
