import * as ObjectModel from "pixelbin-object-model";
import { Dereferenced, WithoutLists, WithoutReferences } from "pixelbin-object-model";

export type ResponseFor<Table> = Dereferenced<WithoutLists<Table>>;

export type Media = ResponseFor<ObjectModel.Media> & ResponseFor<ObjectModel.Metadata> & {
  info: MediaInfo | null;
};
export type MediaInfo = ResponseFor<WithoutReferences<ObjectModel.MediaInfo>>;
export type Catalog = ResponseFor<ObjectModel.Catalog>;
export type Album = ResponseFor<ObjectModel.Album>;
export type Person = ResponseFor<ObjectModel.Person>;
export type Tag = ResponseFor<ObjectModel.Tag>;

export type User = ResponseFor<ObjectModel.User> & {
  catalogs: Catalog[],
  people: Person[],
  tags: Tag[],
  albums: Album[],
};

export interface State {
  user: User | null;
}

export enum Method {
  State = "state",
  // Login = "login",
  // Logout = "logout",
  // UserCreate = "user/create",
  // CatalogCreate = "catalog/create",
  // AlbumCreate = "album/create",
  // AlbumEdit = "album/edit",
  // AlbumAddMedia = "album/add_media",
  // AlbumRemoveMedia = "album/remove_media",
  // TagCreate = "tag/create",
  // TagEdit = "tag/edit",
  // TagFind = "tag/find",
  // PersonCreate = "person/create",
  // MediaGet = "media/get",
  // MediaCreate = "media/create",
  // MediaUpdate = "media/update",
  // MediaSearch = "media/search",
  // MediaThumbnail = "media/thumbnail",
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type MethodList = { [k in Method]: HttpMethod };

export const HttpMethods: MethodList = {
  [Method.State]: "GET",
  // [Method.Login]: "POST",
  // [Method.Logout]: "POST",
  // [Method.UserCreate]: "PUT",
  // [Method.CatalogCreate]: "PUT",
  // [Method.AlbumCreate]: "PUT",
  // [Method.AlbumEdit]: "PATCH",
  // [Method.AlbumAddMedia]: "PUT",
  // [Method.AlbumRemoveMedia]: "DELETE",
  // [Method.TagCreate]: "PUT",
  // [Method.TagEdit]: "PATCH",
  // [Method.TagFind]: "POST",
  // [Method.PersonCreate]: "PUT",
  // [Method.MediaGet]: "GET",
  // [Method.MediaCreate]: "PUT",
  // [Method.MediaUpdate]: "PUT",
  // [Method.MediaSearch]: "POST",
  // [Method.MediaThumbnail]: "GET",
};

// Fake interface
export interface Signature<Request, Response> {
  fakeType: "ApiMethodSignature",
  requestType: Request;
  responseType: Response;
}

// Fake interface
export interface None {
  fakeType: "None";
}

export interface Signatures {
  [Method.State]: Signature<None, State>;
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
