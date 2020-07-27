import { Files } from "formidable";

import { Nullable } from "../utils";
import * as ObjectModel from "./models";
import { Dereferenced, WithoutLists, WithoutReferences } from "./models";

export type RequestDecoder<R> = (data: unknown, files: Files | undefined) => Promise<R>;
export type ResponseFor<Table> = Dereferenced<WithoutLists<Table>>;

export type UnprocessedMedia =
  Omit<ResponseFor<ObjectModel.Media>, "catalog"> & ResponseFor<Nullable<ObjectModel.Metadata>>;
export type UploadedMedia =
  Omit<ResponseFor<WithoutReferences<ObjectModel.UploadedMedia>>, "media" | "fileName">;
export type ProcessedMedia = UnprocessedMedia & UploadedMedia;
export type Media = UnprocessedMedia | ProcessedMedia;

export type Storage = ResponseFor<ObjectModel.Storage>;
export type PublicStorage = Omit<Storage, "accessKeyId" | "secretAccessKey">;
export type Catalog = ResponseFor<ObjectModel.Catalog>;
export type Album = ResponseFor<ObjectModel.Album>;
export type Person = ResponseFor<ObjectModel.Person>;
export type Tag = ResponseFor<ObjectModel.Tag>;

export interface StorageCreateRequest {
  storage: string | Create<Storage>;
}

export type CatalogCreateRequest = Omit<Create<Catalog>, "storage"> & StorageCreateRequest;

export type User = ResponseFor<ObjectModel.User> & {
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
  Omit<ResponseFor<ObjectModel.Media>, "created" | "id"> &
  Partial<ResponseFor<Nullable<ObjectModel.Metadata>>> & {
    file: Blob;
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
  // [Method.MediaUpdate]: "PUT",
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
  // [ApiMethod.AlbumAddMedia]: Signature<AlbumMedia, AlbumData>;
  // [ApiMethod.AlbumRemoveMedia]: Signature<AlbumMedia, AlbumData>;
  [Method.TagCreate]: Signature<Create<Tag>, Tag>;
  [Method.TagEdit]: Signature<Patch<Tag>, Tag>;
  // [ApiMethod.TagFind]: Signature<TagLookup, TagData[]>;
  [Method.PersonCreate]: Signature<Create<Person>, Person>;
  [Method.PersonEdit]: Signature<Patch<Person>, Person>;
  // [ApiMethod.MediaGet]: Signature<Mappable, MediaData>;
  [Method.MediaCreate]: Signature<MediaCreateRequest, Omit<Media, "catalog">>;
  // [ApiMethod.MediaUpdate]: Signature<Patch<MediaCreateData, Media>, MediaData>;
  // [ApiMethod.MediaSearch]: Signature<Search, MediaData[]>;
  // [ApiMethod.MediaThumbnail]: Signature<MediaThumbnail, Blob>;
}

export type SignatureRequest<M extends Method> =
  Signatures[M] extends Signature<infer Request>
    ? Request
    : never;

export type SignatureResponse<M extends Method> =
  Signatures[M] extends Signature<unknown, infer Response>
    ? Response
    : never;
