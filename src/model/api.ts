import { Files as Api } from "formidable";

import { Nullable } from "../utils";
import * as ObjectModel from "./models";

export type RequestDecoder<R> = (data: unknown, files: Api | undefined) => Promise<R>;

export type UnprocessedMedia = Omit<ObjectModel.UnprocessedMedia, "catalog">;
export type ProcessedMedia = Omit<ObjectModel.ProcessedMedia, "catalog">;
export type Media = UnprocessedMedia | ProcessedMedia;

export type Storage = ObjectModel.Storage;
export type PublicStorage = Omit<Storage, "accessKeyId" | "secretAccessKey">;
export type Catalog = ObjectModel.Catalog;
export type Album = ObjectModel.Album;
export type Person = ObjectModel.Person;
export type Tag = ObjectModel.Tag;

export interface StorageCreateRequest {
  storage: string | Create<Storage>;
}

export type CatalogCreateRequest = Omit<Create<Catalog>, "storage"> & StorageCreateRequest;

export type User = ObjectModel.User & {
  catalogs: Omit<Catalog, "storage">[],
  people: Person[],
  tags: Tag[],
  albums: Album[],
};

export interface State {
  user: User | null;
}

export type Create<T> = Omit<T, "id">;
export type Patch<T> = Partial<Omit<T, "id" | "catalog">> & { id: string };

export interface LoginRequest {
  email: string;
  password: string;
}

export type MediaGetRequest = string[];

export type MediaCreateRequest =
  Omit<ObjectModel.Media, "created" | "id"> &
  Partial<Nullable<ObjectModel.Metadata>> & {
    file: Blob;
    albums?: string[];
    tags?: string[];
    people?: string[];
  };

export type MediaUpdateRequest = Partial<Omit<MediaCreateRequest, "catalog">> & {
  id: string;
};

export interface MediaThumbnailRequest {
  id: string;
  size: number;
}

export enum RelationType {
  Tag = "tag",
  Album = "album",
  Person = "person",
}

export interface MediaRelationAdd {
  operation: "add",
  type: RelationType,
  media: string[],
  items: string[],
}

export interface MediaRelationDelete {
  operation: "delete",
  type: RelationType,
  media: string[],
  items: string[],
}

export interface MediaSetRelations {
  operation: "setRelations",
  type: RelationType,
  media: string[],
  items: string[],
}

export interface RelationsSetMedia {
  operation: "setMedia",
  type: RelationType,
  items: string[],
  media: string[],
}

export type MediaRelationChange =
  MediaRelationAdd | MediaRelationDelete | MediaSetRelations | RelationsSetMedia;

export enum Method {
  State = "state",
  Login = "login",
  Logout = "logout",
  CatalogCreate = "catalog/create",
  AlbumCreate = "album/create",
  AlbumEdit = "album/edit",
  TagCreate = "tag/create",
  TagEdit = "tag/edit",
  PersonCreate = "person/create",
  PersonEdit = "person/edit",
  MediaGet = "media/get",
  MediaCreate = "media/create",
  // MediaUpdate = "media/update",
  // MediaSearch = "media/search",
  MediaThumbnail = "media/thumbnail",
  MediaRelations = "media/relations",
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type MethodList = { [k in Method]: HttpMethod };

export const HttpMethods: MethodList = {
  [Method.State]: "GET",
  [Method.Login]: "POST",
  [Method.Logout]: "POST",
  [Method.CatalogCreate]: "PUT",
  [Method.AlbumCreate]: "PUT",
  [Method.AlbumEdit]: "PATCH",
  [Method.TagCreate]: "PUT",
  [Method.TagEdit]: "PATCH",
  [Method.PersonCreate]: "PUT",
  [Method.PersonEdit]: "PATCH",
  [Method.MediaGet]: "GET",
  [Method.MediaCreate]: "PUT",
  // [Method.MediaUpdate]: "PATCH",
  // [Method.MediaSearch]: "POST",
  [Method.MediaThumbnail]: "GET",
  [Method.MediaRelations]: "PATCH",
};

// Fake interface
export interface Signature<Request = unknown, Response = unknown> {
  fakeType: "Signature",
  requestType: Request;
  responseType: Response;
}

// Fake interface
export interface None {
  fakeType: "None";
}

export interface Signatures {
  [Method.State]: Signature<None, State>;
  [Method.Login]: Signature<LoginRequest, State>;
  [Method.Logout]: Signature<None, State>;
  [Method.CatalogCreate]: Signature<CatalogCreateRequest, Catalog>;
  [Method.AlbumCreate]: Signature<Create<Album>, Album>;
  [Method.AlbumEdit]: Signature<Patch<Album>, Album>;
  [Method.TagCreate]: Signature<Create<Tag>, Tag>;
  [Method.TagEdit]: Signature<Patch<Tag>, Tag>;
  [Method.PersonCreate]: Signature<Create<Person>, Person>;
  [Method.PersonEdit]: Signature<Patch<Person>, Person>;
  [Method.MediaGet]: Signature<MediaGetRequest, Media[]>;
  [Method.MediaCreate]: Signature<MediaCreateRequest, Omit<UnprocessedMedia, "catalog">>;
  // [Method.MediaUpdate]: Signature<MediaUpdateRequest, Omit<Media, "catalog">>;
  // [Method.MediaSearch]: Signature<Search, MediaData[]>;
  [Method.MediaThumbnail]: Signature<MediaThumbnailRequest, Blob>;
  [Method.MediaRelations]: Signature<MediaRelationChange[], Media[]>;
}

export type SignatureRequest<M extends Method> =
  Signatures[M] extends Signature<infer Request>
    ? Request
    : never;

export type SignatureResponse<M extends Method> =
  Signatures[M] extends Signature<unknown, infer Response>
    ? Response
    : never;
