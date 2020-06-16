import type { Orientation } from "media-metadata";
import moment from "moment";

export interface IdTable<K = string> {
  id: K;
}

export type ForeignKey<T, I = "id"> = I extends keyof T ? T[I] : never;

export interface UserData extends IdTable {
  id: string;
  email: string;
  fullname: string;
  hadCatalog: boolean;
  verified: boolean;
}

export interface CatalogData extends IdTable {
  name: string;
}

export interface PersonData extends IdTable {
  catalog: ForeignKey<CatalogData>;
  name: string;
}

export interface TagData extends IdTable {
  catalog: ForeignKey<CatalogData>;
  parent: ForeignKey<TagData> | null;
  name: string;
}

export interface AlbumData extends IdTable {
  catalog: ForeignKey<CatalogData>;
  parent: ForeignKey<AlbumData> | null;
  stub: string | null;
  name: string;
}

export interface MetadataData {
  filename: string | null;
  title: string | null;
  taken: moment.Moment | null;
  offset: number | null;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  orientation: Orientation | null;
  make: string | null;
  model: string | null;
  lens: string | null;
  photographer: string | null;
  aperture: number | null;
  exposure: number | null;
  iso: number | null;
  focalLength: number | null;
  bitrate: number | null;
}

export interface MediaData extends IdTable, MetadataData {
  catalog: ForeignKey<CatalogData>;
  created: moment.Moment;
}

export interface MediaInfoData extends IdTable, MetadataData {
  media: ForeignKey<MediaData>;
  processVersion: number;
  uploaded: moment.Moment;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  fileSize: number;
}
