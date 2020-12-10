import type * as ObjectModel from "../models";
import type { Query } from "../search";

export interface Login {
  email: string;
  password: string;
}

export type Signup = Omit<
  ObjectModel.User,
  "administrator" | "created" | "lastLogin" | "verified"
> & {
  password: string;
};

export type StorageTest = Omit<StorageCreate, "name">;

export type StorageCreate = Omit<ObjectModel.Storage, "id">;

export interface CatalogCreate {
  storage: ObjectModel.Storage["id"];
  catalog: Omit<ObjectModel.Catalog, "id">;
}

export interface CatalogEdit {
  id: ObjectModel.Catalog["id"];
  catalog: Partial<Omit<ObjectModel.Catalog, "id">>;
}

export interface CatalogList {
  id: ObjectModel.Catalog["id"];
}

export interface AlbumCreate {
  catalog: ObjectModel.Catalog["id"];
  album: Omit<ObjectModel.Album, "id">;
}

export interface AlbumEdit {
  id: ObjectModel.Album["id"];
  album: Partial<Omit<ObjectModel.Album, "id">>;
}

export interface AlbumList {
  id: ObjectModel.Album["id"];
  recursive: boolean;
}

export type AlbumDelete = ObjectModel.Album["id"][];

export interface TagCreate {
  catalog: ObjectModel.Catalog["id"];
  tag: Omit<ObjectModel.Tag, "id">;
}

export interface TagEdit {
  id: ObjectModel.Tag["id"];
  tag: Partial<Omit<ObjectModel.Tag, "id">>;
}

export interface TagFind {
  catalog: ObjectModel.Catalog["id"];
  names: string[];
}

export interface PersonCreate {
  catalog: ObjectModel.Catalog["id"];
  person: Omit<ObjectModel.Person, "id">;
}

export interface PersonEdit {
  id: ObjectModel.Album["id"];
  person: Partial<Omit<ObjectModel.Person, "id">>;
}

export type PersonDelete = ObjectModel.Person["id"][];

export interface MediaGet {
  id: string;
}

export interface MediaSearch {
  catalog: ObjectModel.Catalog["id"];
  query: Query;
}

export type SelectedTag = string[] | ObjectModel.Tag["id"];
export type SelectedPerson = string | {
  person: ObjectModel.Person["id"];
  location?: ObjectModel.Location | null;
} | {
  name: string;
  location?: ObjectModel.Location | null;
};

export interface MediaCreate {
  catalog: ObjectModel.Catalog["id"];
  media?: Partial<Omit<ObjectModel.Media, "id" | "file" | "created" | "updated">>;
  file: Blob;
  albums?: string[];
  tags?: SelectedTag[];
  people?: SelectedPerson[];
}

export interface MediaEdit {
  id: ObjectModel.Media["id"];
  media?: Partial<Omit<ObjectModel.Media, "id" | "file" | "created" | "updated">>;
  file?: Blob;
  albums?: string[];
  tags?: SelectedTag[];
  people?: SelectedPerson[];
}

export interface MediaRelationAdd {
  operation: "add",
  type: ObjectModel.RelationType,
  media: ObjectModel.MediaInfo["id"][],
  items: string[],
}

export interface MediaRelationDelete {
  operation: "delete",
  type: ObjectModel.RelationType,
  media: ObjectModel.MediaInfo["id"][],
  items: string[],
}

export interface MediaSetRelations {
  operation: "setRelations",
  type: ObjectModel.RelationType,
  media: ObjectModel.MediaInfo["id"][],
  items: string[],
}

export interface RelationsSetMedia {
  operation: "setMedia",
  type: ObjectModel.RelationType,
  items: string[],
  media: ObjectModel.MediaInfo["id"][],
}

export type MediaRelations =
  MediaRelationAdd | MediaRelationDelete | MediaSetRelations | RelationsSetMedia;

export type MediaPeople = {
  media: ObjectModel.Media["id"];
  person: ObjectModel.Person["id"];
  location?: ObjectModel.Location | null;
}[];

export interface SavedSearchCreate {
  catalog: ObjectModel.Catalog["id"];
  search: Omit<ObjectModel.SavedSearch, "id">;
}

export interface SavedSearchEdit {
  id: ObjectModel.SavedSearch["id"];
  search: Partial<Omit<ObjectModel.SavedSearch, "id">>;
}

export interface SharedSearch {
  id: string;
}
