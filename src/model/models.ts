import type { Orientation } from "media-metadata";
import type { Moment } from "moment-timezone";

import { AllNull, Nullable } from "../utils";

export type Date = Moment;

export interface IdType<K = string> {
  id: K;
}

export interface User {
  email: string;
  fullname: string;
  created: Date;
  lastLogin: Date | null;
  verified: boolean;
}

export interface Storage extends IdType {
  owner: User["email"],
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  path: string | null;
  endpoint: string | null;
  publicUrl: string | null;
}

export interface Catalog extends IdType {
  name: string;
  storage: Storage["id"];
}

export interface Person extends IdType {
  catalog: Catalog["id"];
  name: string;
}

export interface Location {
  left: number,
  right: number,
  top: number,
  bottom: number,
}

export type MediaPerson = Person & {
  location: Location | null,
};

export interface Tag extends IdType {
  catalog: Catalog["id"];
  parent: Tag["id"] | null;
  name: string;
}

export interface Album extends IdType {
  catalog: Catalog["id"];
  parent: Album["id"] | null;
  name: string;
}

export interface Metadata {
  filename: string;
  title: string;
  description: string;
  label: string;
  category: string;
  taken: Date;
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
  shutterSpeed: string;
  iso: number;
  focalLength: number;
  rating: number;
}

export type MetadataFields<T> = {
  [K in keyof Metadata]: Metadata[K] extends T ? K : never;
}[keyof Metadata];

export type TypeName<K> = K extends string
  ? "string"
  : K extends Date
    ? "date"
    : K extends number
      ? "number"
      : never;

type FieldTypes = {
  [K in keyof Metadata]: TypeName<Metadata[K]>;
};

export const MetadataColumns: FieldTypes = {
  filename: "string",
  title: "string",
  description: "string",
  category: "string",
  label: "string",
  timeZone: "string",
  location: "string",
  city: "string",
  state: "string",
  country: "string",
  make: "string",
  model: "string",
  lens: "string",
  photographer: "string",
  shutterSpeed: "string",
  longitude: "number",
  latitude: "number",
  altitude: "number",
  orientation: "number",
  aperture: "number",
  iso: "number",
  focalLength: "number",
  rating: "number",
  taken: "date",
};

export interface Media extends IdType {
  catalog: Catalog["id"];
  created: Date;
}

export interface MediaLists {
  tags: Tag[];
  albums: Album[];
  people: MediaPerson[];
}

export interface FileInfo {
  fileName: string;
  fileSize: number;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  frameRate: number | null;
  bitRate: number | null;
}

export type Original = IdType & FileInfo & {
  media: Media["id"];
  uploaded: Date;
};

export type UnprocessedMedia = Media & Nullable<Metadata> & MediaLists;
export type ProcessedMedia = UnprocessedMedia & Omit<Original, "id" | "media" | "fileName">;

export enum AlternateFileType {
  Thumbnail = "thumbnail",
  Poster = "poster",
  Reencode = "reencode",
}

export type AlternateFile = IdType & FileInfo & {
  original: Original["id"];
  type: AlternateFileType;
};

export function emptyMetadata(): AllNull<Metadata> {
  return Object.fromEntries(
    Object.keys(MetadataColumns).map((column: string): [string, null] => [column, null]),
  ) as AllNull<Metadata>;
}
