import type { AllNull, Nullable, DateTime } from "../utils";

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
  created: DateTime;
  lastLogin: DateTime | null;
  verified: boolean;
}

export interface Storage extends IdType {
  user: User["email"],
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
  taken: DateTime;
  takenZone: string;
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
  : K extends DateTime
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

export interface Media extends IdType {
  catalog: Catalog["id"];
  created: DateTime;
  updated: DateTime;
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
  uploaded: DateTime;
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

export const emptyMetadata: AllNull<Metadata> = Object.fromEntries(
  Object.keys(MetadataColumns).map((column: string): [string, null] => [column, null]),
) as AllNull<Metadata>;
