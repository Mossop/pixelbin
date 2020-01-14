import moment from "moment";
import { JsonDecoder } from "ts.data.json";
import { Orientation } from "media-metadata/lib/metadata";

import { Mappable, MapOf } from "../utils/maps";
import { DateDecoder, OrientationDecoder, MapDecoder } from "../utils/decoders";
import { makeRequest, MethodList, RequestData, JsonRequestData, QueryRequestData,
  FormRequestData, JsonDecoderDecoder, BlobDecoder, VoidDecoder } from "./helpers";

export type Patch<R> = Partial<R> & Mappable;

export interface PersonData {
  id: string;
  catalog: string;
  fullname: string;
}

export const PersonDataDecoder = JsonDecoder.object<PersonData>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    fullname: JsonDecoder.string,
  },
  "PersonData"
);

export interface TagData {
  id: string;
  catalog: string;
  parent: string | null;
  name: string;
}

export const TagDataDecoder = JsonDecoder.object<TagData>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    parent: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    name: JsonDecoder.string,
  },
  "TagData"
);

export interface AlbumData {
  id: string;
  catalog: string;
  stub: string | null;
  name: string;
  parent: string | null;
}

export const AlbumDataDecoder = JsonDecoder.object<AlbumData>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    stub: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    name: JsonDecoder.string,
    parent: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
  },
  "AlbumData"
);

export interface CatalogData {
  id: string;
  root: string;
  people: MapOf<PersonData>;
  tags: MapOf<TagData>;
  albums: MapOf<AlbumData>;
}

export const CatalogDataDecoder = JsonDecoder.object<CatalogData>(
  {
    id: JsonDecoder.string,
    root: JsonDecoder.string,
    people: MapDecoder(PersonDataDecoder, "MapOf<PersonData>"),
    tags: MapDecoder(TagDataDecoder, "MapOf<TagData>"),
    albums: MapDecoder(AlbumDataDecoder, "MapOf<AlbumData>"),
  },
  "CatalogData"
);

export interface UserData {
  email: string;
  fullname: string;
  hadCatalog: boolean;
  verified: boolean;
  catalogs: MapOf<CatalogData>;
}

export const UserDataDecoder = JsonDecoder.object<UserData>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
    catalogs: MapDecoder(CatalogDataDecoder, "MapOf<CatalogData>"),
  },
  "UserData"
);

export interface ServerData {
  user: UserData | null;
}

export const ServerDataDecoder = JsonDecoder.object<ServerData>(
  {
    user: JsonDecoder.oneOf([UserDataDecoder, JsonDecoder.isNull(null)], "UserCreateData | null"),
  },
  "ServerData"
);

export interface MetadataData {
  filename: string | null;
  title: string | null;
  taken: moment.Moment | null;
  offset: number | null;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  orientation: Orientation | null;
  make: string | null;
  model: string | null;
  lens: string | null;
  photographer: string | null;
  aperture: number | null;
  exposure: number | null;
  iso: number | null;
  focalLength: number | null;
  bitrate: number | null;
}

export const MetadataDataDecoder = JsonDecoder.object<MetadataData>(
  {
    filename: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    title: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    taken: JsonDecoder.oneOf([DateDecoder, JsonDecoder.isNull(null)], "moment.Moment | null"),
    offset: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    longitude: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    latitude: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    altitude: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    location: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    city: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    state: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    country: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    orientation: JsonDecoder.oneOf([OrientationDecoder, JsonDecoder.isNull(null)], "Orientation | null"),
    make: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    model: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    lens: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    photographer: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    aperture: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    exposure: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    iso: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    focalLength: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    bitrate: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
  },
  "MetadataData"
);

export interface UnprocessedMediaData {
  id: string;
  created: moment.Moment;
  processVersion: number | null;
  uploaded: moment.Moment | null;
  mimetype: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fileSize: number | null;
  tags: string[];
  albums: string[];
  people: string[];
  metadata: MetadataData;
}

export const UnprocessedMediaDataDecoder = JsonDecoder.object<UnprocessedMediaData>(
  {
    id: JsonDecoder.string,
    created: DateDecoder,
    processVersion: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    uploaded: JsonDecoder.oneOf([DateDecoder, JsonDecoder.isNull(null)], "moment.Moment | null"),
    mimetype: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    width: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    height: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    duration: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    fileSize: JsonDecoder.oneOf([JsonDecoder.number, JsonDecoder.isNull(null)], "number | null"),
    tags: JsonDecoder.array(JsonDecoder.string, "string[]"),
    albums: JsonDecoder.array(JsonDecoder.string, "string[]"),
    people: JsonDecoder.array(JsonDecoder.string, "string[]"),
    metadata: MetadataDataDecoder,
  },
  "UnprocessedMediaData"
);

export interface LoginData {
  email: string;
  password: string;
}

export interface UserCreateData {
  email: string;
  password: string;
  fullname: string;
}

export interface ServerStorageData {
  type: "server";
}

export interface BackblazeStorageData {
  type: "backblaze";
  keyId: string;
  key: string;
  bucket: string;
  path: string;
}

export interface CatalogCreateData {
  name: string;
  storage: ServerStorageData | BackblazeStorageData;
}

export interface AlbumCreateData {
  catalog: string;
  stub?: string | null;
  name: string;
  parent: string | null;
}

export interface AlbumMedia {
  id: string;
  media: string[];
}

export interface TagCreateData {
  catalog: string;
  parent: string | null;
  name: string;
}

export interface TagLookup {
  catalog: string;
  path: string[];
}

export interface PersonCreateData {
  catalog: string;
  fullname: string;
}

export interface MetadataUpdateData {
  filename?: string | null;
  title?: string | null;
  taken?: moment.Moment | null;
  offset?: number | null;
  longitude?: number | null;
  latitude?: number | null;
  altitude?: number | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  orientation?: Orientation | null;
  make?: string | null;
  model?: string | null;
  lens?: string | null;
  photographer?: string | null;
  aperture?: number | null;
  exposure?: number | null;
  iso?: number | null;
  focalLength?: number | null;
  bitrate?: number | null;
}

export interface MediaCreateData {
  catalog: string;
  tags: string[];
  albums: string[];
  people: string[];
  metadata?: MetadataUpdateData;
}

export interface MediaUpload {
  id: string;
  file: Blob;
}

export interface Query {
}

export interface Search {
  catalog: string;
  query: Query;
}

export interface MediaThumbnail {
  id: string;
  size: number;
}

export enum ApiMethod {
  Login = "login",
  Logout = "logout",
  UserCreate = "user/create",
  CatalogCreate = "catalog/create",
  AlbumCreate = "album/create",
  AlbumEdit = "album/edit",
  AlbumAddMedia = "album/add_media",
  AlbumRemoveMedia = "album/remove_media",
  TagCreate = "tag/create",
  TagFind = "tag/find",
  PersonCreate = "person/create",
  MediaGet = "media/get",
  MediaCreate = "media/create",
  MediaUpload = "media/upload",
  MediaSearch = "media/search",
  MediaThumbnail = "media/thumbnail",
}

export const HttpMethods: MethodList = {
  [ApiMethod.Login]: "POST",
  [ApiMethod.Logout]: "POST",
  [ApiMethod.UserCreate]: "PUT",
  [ApiMethod.CatalogCreate]: "PUT",
  [ApiMethod.AlbumCreate]: "PUT",
  [ApiMethod.AlbumEdit]: "PATCH",
  [ApiMethod.AlbumAddMedia]: "PUT",
  [ApiMethod.AlbumRemoveMedia]: "DELETE",
  [ApiMethod.TagCreate]: "PUT",
  [ApiMethod.TagFind]: "POST",
  [ApiMethod.PersonCreate]: "PUT",
  [ApiMethod.MediaGet]: "GET",
  [ApiMethod.MediaCreate]: "PUT",
  [ApiMethod.MediaUpload]: "PUT",
  [ApiMethod.MediaSearch]: "POST",
  [ApiMethod.MediaThumbnail]: "GET",
};

export function request(method: ApiMethod.Login, data: LoginData): Promise<ServerData>;
export function request(method: ApiMethod.Logout): Promise<ServerData>;
export function request(method: ApiMethod.UserCreate, data: UserCreateData): Promise<ServerData>;
export function request(method: ApiMethod.CatalogCreate, data: CatalogCreateData): Promise<CatalogData>;
export function request(method: ApiMethod.AlbumCreate, data: AlbumCreateData): Promise<AlbumData>;
export function request(method: ApiMethod.AlbumEdit, data: Patch<AlbumCreateData>): Promise<AlbumData>;
export function request(method: ApiMethod.AlbumAddMedia, data: AlbumMedia): Promise<void>;
export function request(method: ApiMethod.AlbumRemoveMedia, data: AlbumMedia): Promise<void>;
export function request(method: ApiMethod.TagCreate, data: TagCreateData): Promise<TagData>;
export function request(method: ApiMethod.TagFind, data: TagLookup): Promise<TagData>;
export function request(method: ApiMethod.PersonCreate, data: PersonCreateData): Promise<PersonData>;
export function request(method: ApiMethod.MediaGet, data: Mappable): Promise<UnprocessedMediaData>;
export function request(method: ApiMethod.MediaCreate, data: MediaCreateData): Promise<UnprocessedMediaData>;
export function request(method: ApiMethod.MediaUpload, data: MediaUpload): Promise<UnprocessedMediaData>;
export function request(method: ApiMethod.MediaSearch, data: Search): Promise<UnprocessedMediaData[]>;
export function request(method: ApiMethod.MediaThumbnail, data: MediaThumbnail): Promise<Blob>;

export function request(path: ApiMethod, data?: object): Promise<object | void> {
  let request: RequestData<object | void>;

  switch (path) {
    case ApiMethod.Login:
      request = new JsonRequestData(data, JsonDecoderDecoder(ServerDataDecoder));
      break;
    case ApiMethod.Logout:
      request = new RequestData(JsonDecoderDecoder(ServerDataDecoder));
      break;
    case ApiMethod.UserCreate:
      request = new JsonRequestData(data, JsonDecoderDecoder(ServerDataDecoder));
      break;
    case ApiMethod.CatalogCreate:
      request = new JsonRequestData(data, JsonDecoderDecoder(CatalogDataDecoder));
      break;
    case ApiMethod.AlbumCreate:
      request = new JsonRequestData(data, JsonDecoderDecoder(AlbumDataDecoder));
      break;
    case ApiMethod.AlbumEdit:
      request = new JsonRequestData(data, JsonDecoderDecoder(AlbumDataDecoder));
      break;
    case ApiMethod.AlbumAddMedia:
      request = new JsonRequestData(data, VoidDecoder);
      break;
    case ApiMethod.AlbumRemoveMedia:
      request = new JsonRequestData(data, VoidDecoder);
      break;
    case ApiMethod.TagCreate:
      request = new JsonRequestData(data, JsonDecoderDecoder(TagDataDecoder));
      break;
    case ApiMethod.TagFind:
      request = new JsonRequestData(data, JsonDecoderDecoder(TagDataDecoder));
      break;
    case ApiMethod.PersonCreate:
      request = new JsonRequestData(data, JsonDecoderDecoder(PersonDataDecoder));
      break;
    case ApiMethod.MediaGet:
      request = new QueryRequestData(data, JsonDecoderDecoder(UnprocessedMediaDataDecoder));
      break;
    case ApiMethod.MediaCreate:
      request = new JsonRequestData(data, JsonDecoderDecoder(UnprocessedMediaDataDecoder));
      break;
    case ApiMethod.MediaUpload:
      request = new FormRequestData(data, JsonDecoderDecoder(UnprocessedMediaDataDecoder));
      break;
    case ApiMethod.MediaSearch:
      request = new JsonRequestData(data, JsonDecoderDecoder(JsonDecoder.array(UnprocessedMediaDataDecoder, "UnprocessedMediaData[]")));
      break;
    case ApiMethod.MediaThumbnail:
      request = new QueryRequestData(data, BlobDecoder);
      break;
  }

  return makeRequest(path, request);
}
