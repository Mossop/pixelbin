import type { Orientation } from "media-metadata";
import type { Moment } from "moment";

export interface IdType<K = string> {
  id: K;
}

export type Reference<Table, Column = "id"> = Column extends keyof Table ? {
  fakeType: "ForeignKey",
  table: Table,
  column: Column,
} : never;

export type ReferenceType<T> =
  T extends Reference<infer Table, infer Column>
    ? Column extends keyof Table
      ? Table[Column]
      : never
    : T;

export type List<Table, Column = "id"> = Column extends keyof Table ? {
  fakeType: "List",
  table: Table,
  column: Column,
} : never;

export type ListType<T> =
  T extends List<infer Table, infer Column>
    ? Column extends keyof Table
      ? Table[Column][]
      : never
    : T;

export type Dereference<T> =
  T extends List<infer Table, infer Column>
    ? Column extends keyof Table
      ? Table[Column][]
      : never
    : T extends Reference<infer Table, infer Column>
      ? Column extends keyof Table
        ? Table[Column]
        : never
      : T;

export type Dereferenced<Table> = {
  [Column in keyof Table]: Dereference<Table[Column]>;
};

export type ReferencesIn<Table> = {
  [Column in keyof Table]: Table[Column] extends Reference<unknown> ? Column : never;
}[keyof Table];

export type WithoutReferences<Table> = Omit<Table, ReferencesIn<Table>>;

export type ListsIn<Table> = {
  [Column in keyof Table]: Table[Column] extends List<unknown> ? Column : never;
}[keyof Table];

export type WithoutLists<Table> = Omit<Table, ListsIn<Table>>;

export type WithoutLinks<Table> = Omit<Table, ReferencesIn<Table> | ListsIn<Table>>;

export interface User {
  email: string;
  fullname: string;
  hadCatalog: boolean;
  verified: boolean;
}

export interface Storage extends IdType {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string | null;
  publicUrl: string | null;
}

export interface Catalog extends IdType {
  name: string;
  storage: Reference<Storage>;
}

export interface Person extends IdType {
  catalog: Reference<Catalog>;
  name: string;
}

export interface Tag extends IdType {
  catalog: Reference<Catalog>;
  parent: Reference<Tag> | null;
  name: string;
}

export interface Album extends IdType {
  catalog: Reference<Catalog>;
  parent: Reference<Album> | null;
  stub: string | null;
  name: string;
}

export interface Metadata {
  filename: string | null;
  title: string | null;
  taken: Moment | null;
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

export const metadataColumns: (keyof Metadata)[] = [
  "filename",
  "title",
  "taken",
  "offset",
  "longitude",
  "latitude",
  "altitude",
  "location",
  "city",
  "state",
  "country",
  "orientation",
  "make",
  "model",
  "lens",
  "photographer",
  "aperture",
  "exposure",
  "iso",
  "focalLength",
  "bitrate",
];

export interface Media extends IdType {
  catalog: Reference<Catalog>;
  created: Moment;
}

export interface MediaInfo extends IdType {
  media: Reference<Media>;
  uploaded: Moment;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  fileSize: number;
}
