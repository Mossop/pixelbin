import type { AllNull, DateTime } from "../utils";
import type { Query } from "./search";

export const CURRENT_PROCESS_VERSION = 3;

export const MEDIA_THUMBNAIL_SIZES = [
  150,
  200,
  250,
  300,
  350,
  400,
  450,
  500,
];

export enum RelationType {
  Tag = "tag",
  Album = "album",
  Person = "person",
}

/**
 * Describes the orientation of the image with two sides. The first side is
 * the side represented by the zeroth row. The second side is the side
 * represented by the zeroth column.
 */
export enum Orientation {
  TopLeft = 1,
  TopRight = 2,
  BottomRight = 3,
  BottomLeft = 4,
  LeftTop = 5,
  RightTop = 6,
  RightBottom = 7,
  LeftBottom = 8,
}

export interface IdType<K = string> {
  id: K;
}

export interface User {
  email: string;
  fullname: string;
  administrator: boolean;
  created: DateTime;
  lastLogin: DateTime | null;
  verified: boolean;
}

export interface Storage extends IdType {
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
}

export interface Person extends IdType {
  name: string;
}

export interface Location {
  left: number,
  right: number,
  top: number,
  bottom: number,
}

export interface Tag extends IdType {
  name: string;
  parent: Tag["id"] | null;
}

export interface Album extends IdType {
  name: string;
  parent: Album["id"] | null;
}

export interface SavedSearch extends IdType {
  name: string;
  shared: boolean;
  query: Query;
}

export interface Metadata {
  filename: string | null;
  title: string | null;
  description: string | null;
  label: string | null;
  category: string | null;
  taken: DateTime | null;
  takenZone: string | null;
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
  shutterSpeed: string | null;
  iso: number | null;
  focalLength: number | null;
  rating: number | null;
}

export type TypeName<K> = K extends string
  ? "string"
  : K extends DateTime
    ? "date"
    : K extends number
      ? "number"
      : never;

type FieldTypes = {
  [K in keyof Metadata]: TypeName<Metadata[K]>;
};

export const MetadataColumns: FieldTypes = {
  title: "string",
  filename: "string",
  description: "string",
  category: "string",
  label: "string",
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
  takenZone: "string",
};

export interface MediaInfo extends IdType {
  created: DateTime;
  updated: DateTime;
}

export interface MediaAlbum {
}

export interface MediaTag {
}

export interface MediaPerson {
  location: Location | null;
}

export interface FileInfo {
  fileSize: number;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  frameRate: number | null;
  bitRate: number | null;
}

export type MediaFile = IdType & FileInfo & {
  uploaded: DateTime;
  processVersion: number;
};

export type Media = MediaInfo & Metadata & {
  file: MediaFile | null;
};
export type PublicMedia = MediaInfo & {
  file: MediaFile;
};
export type PublicMediaWithMetadata = PublicMedia & Metadata & {
  tags: Tag["name"][];
  people: Person["name"][];
};

export enum AlternateFileType {
  Thumbnail = "thumbnail",
  Reencode = "reencode",
}

export type AlternateFile = IdType & FileInfo & {
  type: AlternateFileType;
};

export const emptyMetadata: AllNull<Metadata> = Object.fromEntries(
  Object.keys(MetadataColumns).map((column: string): [string, null] => [column, null]),
) as AllNull<Metadata>;
