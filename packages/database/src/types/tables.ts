import type { Orientation } from "media-metadata";
import moment from "moment";

import { IdTable, ForeignKey } from "./meta";

export interface User extends IdTable {
  id: string;
  email: string;
  fullname: string;
  hadCatalog: boolean;
  verified: boolean;
}

export interface Catalog extends IdTable {
  name: string;
}

export interface Person extends IdTable {
  catalog: ForeignKey<Catalog>;
  name: string;
}

export interface Tag extends IdTable {
  catalog: ForeignKey<Catalog>;
  parent: ForeignKey<Tag> | null;
  name: string;
}

export interface Album extends IdTable {
  catalog: ForeignKey<Catalog>;
  parent: ForeignKey<Album> | null;
  stub: string | null;
  name: string;
}

export interface Metadata {
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

export interface Media extends IdTable, Metadata {
  catalog: ForeignKey<Catalog>;
  created: moment.Moment;
}

export interface MediaInfo extends IdTable, Metadata {
  media: ForeignKey<Media>;
  processVersion: number;
  uploaded: moment.Moment;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  fileSize: number;
}
