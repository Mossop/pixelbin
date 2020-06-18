import * as ObjectModel from "pixelbin-object-model";
import { WithoutLinks } from "pixelbin-object-model";
import * as Api from "pixelbin-webserver/build/api";
import { JsonDecoder } from "ts.data.json";

import { MapOf } from "../utils/maps";
import { Album, Catalog, Person, Tag, Media, Reference } from "./highlevel";

type StateFor<Table> =
  Table extends ObjectModel.Person
    ? PersonState
    : Table extends ObjectModel.Tag
      ? TagState
      : Table extends ObjectModel.Album
        ? AlbumState
        : Table extends ObjectModel.Catalog
          ? CatalogState
          : Table extends ObjectModel.User
            ? UserState
            : Table extends ObjectModel.Media
              ? MediaState
              : never;

type HighLevelFor<Table> =
  Table extends ObjectModel.Person
    ? Person
    : Table extends ObjectModel.Tag
      ? Tag
      : Table extends ObjectModel.Album
        ? Album
        : Table extends ObjectModel.Catalog
          ? Catalog
          : Table extends ObjectModel.Media
            ? Media
            : never;

type Dereference<T> =
  T extends ObjectModel.List<infer Table>
    ? MapOf<StateFor<Table>>
    : T extends ObjectModel.Reference<infer Table>
      ? Reference<HighLevelFor<Table>>
      : T;

type Dereferenced<Table> = {
  [Column in keyof Table]: Dereference<Table[Column]>;
};

export interface PersonState extends Dereferenced<ObjectModel.Person> {}
export interface TagState extends Dereferenced<WithoutLinks<ObjectModel.Tag>> {}
export interface AlbumState extends Dereferenced<WithoutLinks<ObjectModel.Album>> {}
export interface CatalogState extends ObjectModel.Catalog {}
export interface UserState extends ObjectModel.User {}
export interface UnprocessedMediaState extends ObjectModel.Media {
  info?: null;
}
export interface ProcessedMediaState extends ObjectModel.Media {
  info: MediaInfoState;
}
export type MediaState = UnprocessedMediaState | ProcessedMediaState;
export interface MediaInfoState extends WithoutLinks<ObjectModel.MediaInfo> {}

const PersonDecoder = JsonDecoder.object<Api.Person>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    name: JsonDecoder.string,
  },
  "Person",
);

const TagDecoder = JsonDecoder.object<Api.Tag>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    parent: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    name: JsonDecoder.string,
  },
  "Tag",
);

const AlbumDecoder = JsonDecoder.object<Api.Album>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    stub: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    name: JsonDecoder.string,
    parent: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
  },
  "Album",
);

const CatalogDecoder = JsonDecoder.object<Api.Catalog>(
  {
    id: JsonDecoder.string,
    name: JsonDecoder.string,
  },
  "Catalog",
);

const UserDecoder = JsonDecoder.object<Api.User>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
    catalogs: JsonDecoder.array(CatalogDecoder, "Catalog[]"),
    people: JsonDecoder.array(PersonDecoder, "Person[]"),
    tags: JsonDecoder.array(TagDecoder, "Tag[]"),
    albums: JsonDecoder.array(AlbumDecoder, "Album[]"),
  },
  "UserState",
);

const StateDecoder = JsonDecoder.object<Api.State>(
  {
    user: JsonDecoder.oneOf([UserDecoder, JsonDecoder.isNull(null)], "User | null"),
  },
  "State",
);

type RequestType<T extends Api.Method> =
  Api.Signatures[T] extends Api.Signature<infer Request, unknown> ? Request : never;
type ArgOrUndefined<T> = T extends Api.None ? undefined : T;
type ResponseType<T extends Api.Method> =
  Api.Signatures[T] extends Api.Signature<unknown, infer Response> ? Response : never;

type ResponseDecoder<Signature> =
  Signature extends Api.Signature<unknown, infer Response>
    ? JsonDecoder.Decoder<Response>
    : never;

type ResponseDecoders = {
  [Key in keyof Api.Signatures]: ResponseDecoder<Api.Signatures[Key]>;
};

const decoders: ResponseDecoders = {
  [Api.Method.State]: StateDecoder,
};

export function request<T extends Api.Method>(
  _method: T,
  _data: ArgOrUndefined<RequestType<T>>,
): Promise<ResponseType<T>> {
  throw new Error("Not implemented");
}
