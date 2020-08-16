import { Files as Api } from "formidable";

import { Nullable } from "../utils";
import * as ObjectModel from "./models";
import { Dereferenced, WithoutLists } from "./models";

export type RequestDecoder<R> = (data: unknown, files: Api | undefined) => Promise<R>;
type ApiType<Table> = Dereferenced<WithoutLists<Table>>;

export type UnprocessedMedia = Omit<ApiType<ObjectModel.UnprocessedMedia>, "catalog">;
export type ProcessedMedia = Omit<ApiType<ObjectModel.ProcessedMedia>, "catalog">;
export type Media = UnprocessedMedia | ProcessedMedia;

export type Storage = ApiType<ObjectModel.Storage>;
export type PublicStorage = Omit<Storage, "accessKeyId" | "secretAccessKey">;
export type Catalog = ApiType<ObjectModel.Catalog>;
export type Album = ApiType<ObjectModel.Album>;
export type Person = ApiType<ObjectModel.Person>;
export type Tag = ApiType<ObjectModel.Tag>;

export interface StorageCreateRequest {
  storage: string | Create<Storage>;
}

export type CatalogCreateRequest = Omit<Create<Catalog>, "storage"> & StorageCreateRequest;

export type User = ApiType<ObjectModel.User> & {
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

export type MediaCreateRequest =
  Omit<ApiType<ObjectModel.Media>, "created" | "id"> &
  Partial<ApiType<Nullable<ObjectModel.Metadata>>> & {
    file: Blob;
    albums?: string[];
    tags?: string[];
    people?: string[];
  };

export type MediaUpdateRequest = Partial<Omit<MediaCreateRequest, "catalog">> & {
  id: string;
};

export enum Method {
  State = "state",
  Login = "login",
  Logout = "logout",
  CatalogCreate = "catalog/create",
  AlbumCreate = "album/create",
  AlbumEdit = "album/edit",
  // AlbumAddMedia = "album/add_media",
  // AlbumRemoveMedia = "album/remove_media",
  TagCreate = "tag/create",
  TagEdit = "tag/edit",
  // TagFind = "tag/find",
  PersonCreate = "person/create",
  PersonEdit = "person/edit",
  // MediaGet = "media/get",
  MediaCreate = "media/create",
  // MediaUpdate = "media/update",
  // MediaSearch = "media/search",
  // MediaThumbnail = "media/thumbnail",
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
  // [Method.AlbumAddMedia]: "PUT",
  // [Method.AlbumRemoveMedia]: "DELETE",
  [Method.TagCreate]: "PUT",
  [Method.TagEdit]: "PATCH",
  // [Method.TagFind]: "POST",
  [Method.PersonCreate]: "PUT",
  [Method.PersonEdit]: "PATCH",
  // [Method.MediaGet]: "GET",
  [Method.MediaCreate]: "PUT",
  // [Method.MediaUpdate]: "PATCH",
  // [Method.MediaSearch]: "POST",
  // [Method.MediaThumbnail]: "GET",
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
  // [Method.AlbumAddMedia]: Signature<AlbumMedia, AlbumData>;
  // [Method.AlbumRemoveMedia]: Signature<AlbumMedia, AlbumData>;
  [Method.TagCreate]: Signature<Create<Tag>, Tag>;
  [Method.TagEdit]: Signature<Patch<Tag>, Tag>;
  [Method.PersonCreate]: Signature<Create<Person>, Person>;
  [Method.PersonEdit]: Signature<Patch<Person>, Person>;
  // [ApiMethod.MediaGet]: Signature<Mappable, MediaData>;
  [Method.MediaCreate]: Signature<MediaCreateRequest, Omit<UnprocessedMedia, "catalog">>;
  // [Method.MediaUpdate]: Signature<MediaUpdateRequest, Omit<Media, "catalog">>;
  // [Method.MediaSearch]: Signature<Search, MediaData[]>;
  // [Method.MediaThumbnail]: Signature<MediaThumbnail, Blob>;
}

export type SignatureRequest<M extends Method> =
  Signatures[M] extends Signature<infer Request>
    ? Request
    : never;

export type SignatureResponse<M extends Method> =
  Signatures[M] extends Signature<unknown, infer Response>
    ? Response
    : never;
