import { Files } from "formidable";
import { Moment } from "moment-timezone";

import { Nullable, Primitive } from "../utils";
import * as ObjectModel from "./models";

export enum ErrorCode {
  UnknownException = "server-failure",
  BadMethod = "bad-method",
  NotLoggedIn = "not-logged-in",
  LoginFailed = "login-failed",
  InvalidData = "invalid-data",
  NotFound = "not-found",
}

export interface ErrorData {
  readonly code: ErrorCode;
  readonly data?: Record<string, string>;
}

export type ResponseFor<T> =
  T extends Moment
    ? string
    : T extends Primitive
      ? T
      : T extends (infer A)[]
        ? ResponseFor<A>[]
        : {
          [K in keyof T]: ResponseFor<T[K]>;
        };

export type RequestDecoder<R> = (data: unknown, files: Files | undefined) => Promise<R>;

export type UnprocessedMedia = Omit<ObjectModel.UnprocessedMedia, "catalog">;
export type ProcessedMedia = Omit<ObjectModel.ProcessedMedia, "catalog">;
export type Media = UnprocessedMedia | ProcessedMedia;

export type Storage = ObjectModel.Storage;
export type PublicStorage = Omit<Storage, "accessKeyId" | "secretAccessKey">;
export type Catalog = Omit<ObjectModel.Catalog, "storage">;
export type Album = ObjectModel.Album;
export type Person = ObjectModel.Person;
export type MediaPerson = ObjectModel.MediaPerson;
export type Tag = ObjectModel.Tag;
export type Location = ObjectModel.Location;

export interface MediaPersonLocation {
  media: string;
  person: string;
  location?: Location | null;
}

export interface StorageCreateRequest {
  storage: string | Create<Storage>;
}

export type CatalogCreateRequest = Create<Catalog> & StorageCreateRequest;

export type User = Omit<ObjectModel.User, "lastLogin"> & {
  catalogs: Catalog[],
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

export interface AlbumListRequest {
  id: string;
  recursive: boolean;
}

export interface MediaGetRequest {
  id: string;
}

export type SelectedTag = string | string[];
export type SelectedPerson = string | {
  id: string;
  location?: Location | null;
} | {
  name: string;
  location?: Location | null;
};

export type MediaCreateRequest =
  Omit<ObjectModel.Media, "created" | "id"> &
  Partial<Nullable<ObjectModel.Metadata>> & {
    file: Blob;
    albums?: string[];
    tags?: SelectedTag[];
    people?: SelectedPerson[];
  };

export type MediaUpdateRequest = Partial<Omit<MediaCreateRequest, "catalog">> & {
  id: string;
};

export interface MediaThumbnailRequest {
  id: string;
  size: number;
}

export type SignupRequest = Omit<
  ObjectModel.User,
  "created" | "lastLogin" | "verified"
> & {
  password: string;
};

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

export interface TagFindRequest {
  catalog: string;
  tags: string[];
}

export enum Method {
  State = "state",
  Login = "login",
  Logout = "logout",
  Signup = "signup",
  CatalogCreate = "catalog/create",
  // CatalogEdit = "catalog/edit",
  // CatalogDelete = "catalog/delete",
  AlbumCreate = "album/create",
  AlbumEdit = "album/edit",
  AlbumList = "album/list",
  // AlbumDelete = "album/delete",
  TagCreate = "tag/create",
  TagEdit = "tag/edit",
  TagFind = "tag/find",
  // TagDelete = "tag/delete",
  PersonCreate = "person/create",
  PersonEdit = "person/edit",
  // PersonDelete = "person/delete",
  MediaGet = "media/get",
  MediaCreate = "media/create",
  // MediaUpdate = "media/update",
  MediaThumbnail = "media/thumbnail",
  MediaRelations = "media/relations",
  MediaPeople = "media/people",
  // MediaDelete = "media/delete",
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type MethodList = { [k in Method]: HttpMethod };

export const HttpMethods: MethodList = {
  [Method.State]: "GET",
  [Method.Login]: "POST",
  [Method.Logout]: "POST",
  [Method.Signup]: "PUT",
  [Method.CatalogCreate]: "PUT",
  // [Method.CatalogEdit]: "PATCH",
  // [Method.CatalogDelete]: "DELETE",
  [Method.AlbumCreate]: "PUT",
  [Method.AlbumEdit]: "PATCH",
  [Method.AlbumList]: "GET",
  // [Method.AlbumDelete]: "DELETE",
  [Method.TagCreate]: "PUT",
  [Method.TagEdit]: "PATCH",
  [Method.TagFind]: "POST",
  // [Method.TagDelete]: "DELETE",
  [Method.PersonCreate]: "PUT",
  [Method.PersonEdit]: "PATCH",
  // [Method.PersonDelete]: "DELETE",
  [Method.MediaGet]: "GET",
  [Method.MediaCreate]: "PUT",
  // [Method.MediaUpdate]: "PATCH",
  [Method.MediaThumbnail]: "GET",
  [Method.MediaRelations]: "PATCH",
  [Method.MediaPeople]: "PATCH",
  // [Method.MediaDelete]: "DELETE",
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
  [Method.Signup]: Signature<SignupRequest, State>;
  [Method.CatalogCreate]: Signature<CatalogCreateRequest, Catalog>;
  // [Method.CatalogEdit]: Signature<CatalogEditRequest, void>;
  // [Method.CatalogDelete]: Signature<string[], void>;
  [Method.AlbumCreate]: Signature<Create<Album>, Album>;
  [Method.AlbumEdit]: Signature<Patch<Album>, Album>;
  [Method.AlbumList]: Signature<AlbumListRequest, Media[]>;
  // [Method.AlbumDelete]: Signature<string[], void>;
  [Method.TagCreate]: Signature<Create<Tag>, Tag>;
  [Method.TagEdit]: Signature<Patch<Tag>, Tag>;
  [Method.TagFind]: Signature<TagFindRequest, Tag[]>;
  // [Method.TagDelete]: Signature<string[], void>;
  [Method.PersonCreate]: Signature<Create<Person>, Person>;
  [Method.PersonEdit]: Signature<Patch<Person>, Person>;
  // [Method.PersonDelete]: Signature<string[], void>;
  [Method.MediaGet]: Signature<MediaGetRequest, Media[]>;
  [Method.MediaCreate]: Signature<MediaCreateRequest, Omit<UnprocessedMedia, "catalog">>;
  // [Method.MediaUpdate]: Signature<MediaUpdateRequest, Omit<Media, "catalog">>;
  [Method.MediaThumbnail]: Signature<MediaThumbnailRequest, Blob>;
  [Method.MediaRelations]: Signature<MediaRelationChange[], Media[]>;
  [Method.MediaPeople]: Signature<MediaPersonLocation[], Media[]>;
  // [Method.MediaDelete]: Signature<string[], void>;
}

export type SignatureRequest<M extends Method> =
  Signatures[M] extends Signature<infer Request>
    ? Request
    : never;

export type SignatureResponse<M extends Method> =
  Signatures[M] extends Signature<unknown, infer Response>
    ? Response
    : never;
