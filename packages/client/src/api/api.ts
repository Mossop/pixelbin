import * as ObjectModel from "pixelbin-object-model";
import { WithoutLinks } from "pixelbin-object-model";
import * as Api from "pixelbin-webserver/build/api";
import { JsonDecoder } from "ts.data.json";

import { ReadonlyMapOf } from "../utils/maps";
import { JsonRequestData, JsonDecoderDecoder, makeRequest } from "./helpers";
import { Album, Catalog, Person, Tag, Media, Reference } from "./highlevel";

type StateForObject<Obj> =
  Obj extends ObjectModel.Person
    ? PersonState
    : Obj extends ObjectModel.Tag
      ? TagState
      : Obj extends ObjectModel.Album
        ? AlbumState
        : Obj extends ObjectModel.Catalog
          ? CatalogState
          : Obj extends ObjectModel.User
            ? UserState
            : Obj extends ObjectModel.Media
              ? MediaState
              : never;

type HighLevelForState<State> =
  State extends PersonState
    ? Person
    : State extends TagState
      ? Tag
      : State extends AlbumState
        ? Album
        : State extends CatalogState
          ? Catalog
          : State extends MediaState
            ? Media
            : never;

type StateForHighLevel<HighLevel> =
  HighLevel extends Person
    ? PersonState
    : HighLevel extends Tag
      ? TagState
      : HighLevel extends Album
        ? AlbumState
        : HighLevel extends Catalog
          ? CatalogState
          : HighLevel extends Media
            ? MediaState
            : never;

type HighLevelForObject<Obj> =
  Obj extends ObjectModel.Person
    ? Person
    : Obj extends ObjectModel.Tag
      ? Tag
      : Obj extends ObjectModel.Album
        ? Album
        : Obj extends ObjectModel.Catalog
          ? Catalog
          : Obj extends ObjectModel.Media
            ? Media
            : never;

type Dereference<T> =
  T extends ObjectModel.List<infer Obj>
    ? ReadonlyMapOf<StateForObject<Obj>>
    : T extends ObjectModel.Reference<infer Obj>
      ? Reference<HighLevelForObject<Obj>>
      : T;

type Dereferenced<Obj> = {
  [Column in keyof Obj]: Dereference<Obj[Column]>;
};

export interface PersonState extends Readonly<Dereferenced<ObjectModel.Person>> {}
export interface TagState extends Readonly<Dereferenced<WithoutLinks<ObjectModel.Tag>>> {}
export interface AlbumState extends Readonly<Dereferenced<WithoutLinks<ObjectModel.Album>>> {}
export interface CatalogState extends Readonly<Dereference<ObjectModel.Catalog>> {}
export interface UserState extends Readonly<ObjectModel.User> {
  readonly catalogs: ReadonlyMapOf<CatalogState>;
}
export interface UnprocessedMediaState extends Readonly<ObjectModel.Media> {
  readonly info?: null;
}
export interface ProcessedMediaState extends Readonly<ObjectModel.Media> {
  info: MediaInfoState;
}
export type MediaState = UnprocessedMediaState | ProcessedMediaState;
export interface MediaInfoState extends Readonly<WithoutLinks<ObjectModel.MediaInfo>> {}

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
  "User",
);

const StateDecoder = JsonDecoder.object<Api.State>(
  {
    user: JsonDecoder.oneOf([UserDecoder, JsonDecoder.isNull(null)], "User | null"),
  },
  "State",
);

type RequestType<T extends Api.Method> =
  Api.Signatures[T] extends Api.Signature<infer Request, unknown>
    ? Request extends Api.None
      ? []
      : [Request]
    : never;
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
  method: T,
  ...data: RequestType<T>
): Promise<ResponseType<T>> {
  let request = new JsonRequestData(data, JsonDecoderDecoder(decoders[method]));

  // @ts-ignore: Not sure what is going wrong here.
  return makeRequest(Api.HttpMethods[method], method, request);
}
