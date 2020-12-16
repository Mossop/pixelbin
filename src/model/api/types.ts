import type { Overwrite } from "../../utils";
import type * as ObjectModel from "../models";

export type User = ObjectModel.User & {
  storage: Storage[],
  catalogs: Catalog[],
  people: Person[],
  tags: Tag[],
  albums: Album[],
  searches: SavedSearch[],
};

export type Storage = Omit<ObjectModel.Storage, "owner" | "accessKeyId" | "secretAccessKey">;

export type Catalog = ObjectModel.Catalog & {
  storage: Storage["id"];
};

export type Person = ObjectModel.Person & {
  catalog: Catalog["id"];
};

export type Location = ObjectModel.Location;

export type Tag = ObjectModel.Tag & {
  catalog: Catalog["id"];
};

export type Album = ObjectModel.Album & {
  catalog: Catalog["id"];
};

export type SavedSearch = ObjectModel.SavedSearch & {
  catalog: Catalog["id"];
};

export type MediaAlbum = ObjectModel.MediaAlbum & {
  album: Album["id"];
};

export type MediaTag = ObjectModel.MediaTag & {
  tag: Tag["id"];
};

export type MediaPerson = ObjectModel.MediaPerson & {
  person: Person["id"];
};

export interface MediaRelations {
  albums: MediaAlbum[];
  tags: MediaTag[];
  people: MediaPerson[];
}

export type Alternate = Omit<ObjectModel.AlternateFile, "type"> & {
  url: string;
};

export type MediaFile = Omit<ObjectModel.MediaFile, "processVersion">;

export type Media = Overwrite<ObjectModel.Media, {
  catalog: Catalog["id"];
  file: MediaFile | null;
}>;

export type SharedMedia = Overwrite<ObjectModel.SharedMedia, {
  file: MediaFile;
}>;

export type SharedMediaWithMetadata = Overwrite<ObjectModel.SharedMediaWithMetadata, {
  file: MediaFile;
}>;

export interface SharedSearchResults {
  name: string;
  media: SharedMediaWithMetadata[];
}

export interface Thumbnails {
  encodings: string[];
  sizes: number[];
}

export interface State {
  user: User | null;
  apiHost: string | null;
  thumbnails: Thumbnails;
  encodings: string[];
  videoEncodings: string[];
}

export enum AWSResult {
  Success = "success",
  UploadFailure = "upload-failure",
  DownloadFailure = "download-failure",
  PreSignedFailure = "presigned-failure",
  DeleteFailure = "delete-failure",
  PublicUrlFailure = "public-url-failure",
  UnknownFailure = "unknown-failure",
}

export interface StorageTestResult {
  result: AWSResult;
  message: string | null;
}
