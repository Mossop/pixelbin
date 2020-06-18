import { Tables, RecordFor } from "pixelbin-database";

// Fake interface
export interface MapOf<T> {
  fakeType: "MapOf",
  type: T;
}

type PersonState = RecordFor<Tables.Person>;

type TagState = RecordFor<Tables.Tag>;

type AlbumState = RecordFor<Tables.Album>;

type CatalogState = RecordFor<Tables.Catalog> & {
  people: MapOf<PersonState>;
  tags: MapOf<TagState>;
  albums: MapOf<AlbumState>;
};

type UserState = RecordFor<Tables.User> & {
  catalogs: MapOf<CatalogState>;
};

export interface State {
  user: UserState | null;
}

export enum ApiMethod {
  State = "state",
  Login = "login",
  Logout = "logout",
  UserCreate = "user/create",
  CatalogCreate = "catalog/create",
  AlbumCreate = "album/create",
  AlbumEdit = "album/edit",
  AlbumAddMedia = "album/add_media",
  AlbumRemoveMedia = "album/remove_media",
  TagCreate = "tag/create",
  TagEdit = "tag/edit",
  TagFind = "tag/find",
  PersonCreate = "person/create",
  MediaGet = "media/get",
  MediaCreate = "media/create",
  MediaUpdate = "media/update",
  MediaSearch = "media/search",
  MediaThumbnail = "media/thumbnail",
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type MethodList = { [k in ApiMethod]: HttpMethod };

export const HttpMethods: MethodList = {
  [ApiMethod.State]: "GET",
  [ApiMethod.Login]: "POST",
  [ApiMethod.Logout]: "POST",
  [ApiMethod.UserCreate]: "PUT",
  [ApiMethod.CatalogCreate]: "PUT",
  [ApiMethod.AlbumCreate]: "PUT",
  [ApiMethod.AlbumEdit]: "PATCH",
  [ApiMethod.AlbumAddMedia]: "PUT",
  [ApiMethod.AlbumRemoveMedia]: "DELETE",
  [ApiMethod.TagCreate]: "PUT",
  [ApiMethod.TagEdit]: "PATCH",
  [ApiMethod.TagFind]: "POST",
  [ApiMethod.PersonCreate]: "PUT",
  [ApiMethod.MediaGet]: "GET",
  [ApiMethod.MediaCreate]: "PUT",
  [ApiMethod.MediaUpdate]: "PUT",
  [ApiMethod.MediaSearch]: "POST",
  [ApiMethod.MediaThumbnail]: "GET",
};

// Fake interface
export interface ApiMethodSignature<Request, Response> {
  fakeType: "ApiMethodSignature",
  requestType: Request;
  responseType: Response;
}

// Fake interface
export interface None {
  fakeType: "None";
}

export interface ApiMethodSignatures {
  [ApiMethod.State]: ApiMethodSignature<None, State>;
  // [ApiMethod.Login]: ApiMethodSignature<LoginData, ServerData>;
  // [ApiMethod.Logout]: ApiMethodSignature<never, ServerData>;
  // [ApiMethod.UserCreate]: ApiMethodSignature<UserCreateData, ServerData>;
  // [ApiMethod.CatalogCreate]: ApiMethodSignature<CatalogCreateData, CatalogData>;
  // [ApiMethod.AlbumCreate]: ApiMethodSignature<AlbumCreateData, AlbumData>;
  // [ApiMethod.AlbumEdit]: ApiMethodSignature<Patch<AlbumCreateData, Album>, AlbumData>;
  // [ApiMethod.AlbumAddMedia]: ApiMethodSignature<AlbumMedia, AlbumData>;
  // [ApiMethod.AlbumRemoveMedia]: ApiMethodSignature<AlbumMedia, AlbumData>;
  // [ApiMethod.TagCreate]: ApiMethodSignature<TagCreateData, TagData>;
  // [ApiMethod.TagEdit]: ApiMethodSignature<Patch<TagCreateData, Tag>, TagData>;
  // [ApiMethod.TagFind]: ApiMethodSignature<TagLookup, TagData[]>;
  // [ApiMethod.PersonCreate]: ApiMethodSignature<PersonCreateData, PersonData>;
  // [ApiMethod.MediaGet]: ApiMethodSignature<Mappable, MediaData>;
  // [ApiMethod.MediaCreate]: ApiMethodSignature<MediaCreateData, MediaData>;
  // [ApiMethod.MediaUpdate]: ApiMethodSignature<Patch<MediaCreateData, Media>, MediaData>;
  // [ApiMethod.MediaSearch]: ApiMethodSignature<Search, MediaData[]>;
  // [ApiMethod.MediaThumbnail]: ApiMethodSignature<MediaThumbnail, Blob>;
}
