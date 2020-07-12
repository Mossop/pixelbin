import type { Orientation } from "media-metadata";
import type { Moment } from "moment-timezone";

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
  filename: string;
  title: string;
  taken: Moment;
  timeZone: string;
  longitude: number;
  latitude: number;
  altitude: number;
  location: string;
  city: string;
  state: string;
  country: string;
  orientation: Orientation;
  make: string;
  model: string;
  lens: string;
  photographer: string;
  aperture: number;
  exposure: number;
  iso: number;
  focalLength: number;
}

export const metadataColumns: (keyof Metadata)[] = [
  "filename",
  "title",
  "taken",
  "timeZone",
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
];

export interface Media extends IdType {
  catalog: Reference<Catalog>;
  created: Moment;
}

export interface MediaInfo extends IdType {
  media: Reference<Media>;
  uploaded: Moment;
  fileSize: number;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  frameRate: number | null;
  bitRate: number | null;
}
