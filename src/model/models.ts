import type { Orientation as ObjectModel } from "media-metadata";
import type { Moment } from "moment-timezone";

import { Nullable } from "../utils";

export interface IdType<K = string> {
  id: K;
}

export interface User {
  email: string;
  fullname: string;
  created: Moment;
  lastLogin: Moment | null;
  verified: boolean;
}

export interface Storage extends IdType {
  owner: User["email"],
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
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
  taken: Moment;
  timeZone: string;
  longitude: number;
  latitude: number;
  altitude: number;
  location: string;
  city: string;
  state: string;
  country: string;
  orientation: ObjectModel;
  make: string;
  model: string;
  lens: string;
  photographer: string;
  aperture: number;
  exposure: number;
  iso: number;
  focalLength: number;
  rating: number;
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
  "rating",
];

export interface Media extends IdType {
  catalog: Catalog["id"];
  created: Moment;
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
  uploaded: Moment;
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

