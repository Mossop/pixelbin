import type { Files } from "formidable";

import type { DateTime, Primitive } from "../../utils";
import type * as Requests from "./requests";
import type * as Api from "./types";

export * from "./types";

export enum ErrorCode {
  UnknownException = "server-failure",
  BadMethod = "bad-method",
  NotLoggedIn = "not-logged-in",
  LoginFailed = "login-failed",
  InvalidData = "invalid-data",
  NotFound = "not-found",
  TemporaryFailure = "temporary-failure",
}

export interface ErrorData {
  readonly code: ErrorCode;
  readonly data?: Record<string, string>;
}

export type ApiSerialization<T> =
  T extends DateTime
    ? string
    : T extends Primitive
      ? T
      : T extends (infer A)[]
        ? ApiSerialization<A>[]
        : {
          [K in keyof T]: ApiSerialization<T[K]>;
        };

export type RequestDecoder<R> = (data: unknown, files: Files | undefined) => Promise<R>;

export enum Method {
  State = "state",
  Login = "login",
  Logout = "logout",
  Signup = "signup",
  StorageTest = "storage/test",
  StorageCreate = "storage/create",
  CatalogCreate = "catalog/create",
  CatalogEdit = "catalog/edit",
  // CatalogDelete = "catalog/delete",
  CatalogList = "catalog/list",
  AlbumCreate = "album/create",
  AlbumEdit = "album/edit",
  AlbumList = "album/list",
  AlbumDelete = "album/delete",
  TagCreate = "tag/create",
  TagEdit = "tag/edit",
  TagFind = "tag/find",
  TagDelete = "tag/delete",
  PersonCreate = "person/create",
  PersonEdit = "person/edit",
  PersonDelete = "person/delete",
  MediaGet = "media/get",
  MediaSearch = "media/search",
  MediaCreate = "media/create",
  MediaEdit = "media/edit",
  MediaRelations = "media/relations",
  MediaPeople = "media/people",
  MediaDelete = "media/delete",
  SavedSearchCreate = "search/create",
  SavedSearchEdit = "search/edit",
  SavedSearchDelete = "search/delete",
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type MethodList = { [k in Method]: HttpMethod };

export const HttpMethods: MethodList = {
  [Method.State]: "GET",
  [Method.Login]: "POST",
  [Method.Logout]: "POST",
  [Method.Signup]: "PUT",
  [Method.StorageTest]: "POST",
  [Method.StorageCreate]: "PUT",
  [Method.CatalogCreate]: "PUT",
  [Method.CatalogEdit]: "PATCH",
  // [Method.CatalogDelete]: "DELETE",
  [Method.CatalogList]: "GET",
  [Method.AlbumCreate]: "PUT",
  [Method.AlbumEdit]: "PATCH",
  [Method.AlbumList]: "GET",
  [Method.AlbumDelete]: "DELETE",
  [Method.TagCreate]: "PUT",
  [Method.TagEdit]: "PATCH",
  [Method.TagFind]: "POST",
  [Method.TagDelete]: "DELETE",
  [Method.PersonCreate]: "PUT",
  [Method.PersonEdit]: "PATCH",
  [Method.PersonDelete]: "DELETE",
  [Method.MediaGet]: "GET",
  [Method.MediaSearch]: "POST",
  [Method.MediaCreate]: "PUT",
  [Method.MediaEdit]: "PATCH",
  [Method.MediaRelations]: "PATCH",
  [Method.MediaPeople]: "PATCH",
  [Method.MediaDelete]: "DELETE",
  [Method.SavedSearchCreate]: "PUT",
  [Method.SavedSearchEdit]: "PATCH",
  [Method.SavedSearchDelete]: "DELETE",
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
  [Method.State]: Signature<None, Api.State>;
  [Method.Login]: Signature<Requests.Login, Api.State>;
  [Method.Logout]: Signature<None, Api.State>;
  [Method.Signup]: Signature<Requests.Signup, Api.State>;
  [Method.StorageTest]: Signature<Requests.StorageTest, Api.StorageTestResult>;
  [Method.StorageCreate]: Signature<Requests.StorageCreate, Api.Storage>;
  [Method.CatalogCreate]: Signature<Requests.CatalogCreate, Api.Catalog>;
  [Method.CatalogEdit]: Signature<Requests.CatalogEdit, Api.Catalog>;
  // [Method.CatalogDelete]: Signature<string[], void>;
  [Method.CatalogList]: Signature<Requests.CatalogList, Api.Media[]>;
  [Method.AlbumCreate]: Signature<Requests.AlbumCreate, Api.Album>;
  [Method.AlbumEdit]: Signature<Requests.AlbumEdit, Api.Album>;
  [Method.AlbumList]: Signature<Requests.AlbumList, Api.Media[]>;
  [Method.AlbumDelete]: Signature<Requests.AlbumDelete, void>;
  [Method.TagCreate]: Signature<Requests.TagCreate, Api.Tag>;
  [Method.TagEdit]: Signature<Requests.TagEdit, Api.Tag>;
  [Method.TagFind]: Signature<Requests.TagFind, Api.Tag[]>;
  [Method.TagDelete]: Signature<string[], void>;
  [Method.PersonCreate]: Signature<Requests.PersonCreate, Api.Person>;
  [Method.PersonEdit]: Signature<Requests.PersonEdit, Api.Person>;
  [Method.PersonDelete]: Signature<Requests.PersonDelete, void>;
  [Method.MediaGet]: Signature<Requests.MediaGet, (Api.Media | null)[]>;
  [Method.MediaSearch]: Signature<Requests.MediaSearch, Api.Media[]>;
  [Method.MediaCreate]: Signature<Requests.MediaCreate, Api.Media>;
  [Method.MediaEdit]: Signature<Requests.MediaEdit, Api.Media>;
  [Method.MediaRelations]: Signature<Requests.MediaRelations[], Api.Media[]>;
  [Method.MediaPeople]: Signature<Requests.MediaPeople, Api.Media[]>;
  [Method.MediaDelete]: Signature<string[], void>;
  [Method.SavedSearchCreate]: Signature<Requests.SavedSearchCreate, Api.SavedSearch>;
  [Method.SavedSearchEdit]: Signature<Requests.SavedSearchEdit, Api.SavedSearch>;
  [Method.SavedSearchDelete]: Signature<string[], void>;
}

export type SignatureRequest<M extends Method> =
  Signatures[M] extends Signature<infer Request>
    ? Request
    : never;

export type SignatureResponse<M extends Method> =
  Signatures[M] extends Signature<unknown, infer Response>
    ? Response
    : never;
