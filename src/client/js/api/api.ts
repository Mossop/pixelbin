import { JsonDecoder } from "ts.data.json";

import { Api, ObjectModel, WithoutLinks } from "../../../model";
import { DateDecoder } from "../../../utils";
import { ReadonlyMapOf } from "../utils/maps";
import { JsonRequestData, makeRequest } from "./helpers";
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
  readonly upload?: null;
}
export interface ProcessedMediaState extends Readonly<ObjectModel.Media> {
  upload: UploadedMediaState;
}
export type MediaState = UnprocessedMediaState | ProcessedMediaState;
export interface UploadedMediaState extends Readonly<WithoutLinks<ObjectModel.UploadedMedia>> {}

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
    storage: JsonDecoder.string,
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

const MediaDecoder = JsonDecoder.object<Api.UnprocessedMedia>({
  id: JsonDecoder.string,
  created: DateDecoder,
  filename: JsonDecoder.nullable(JsonDecoder.string),
  title: JsonDecoder.nullable(JsonDecoder.string),
  taken: JsonDecoder.nullable(DateDecoder),
  timeZone: JsonDecoder.nullable(JsonDecoder.string),
  longitude: JsonDecoder.nullable(JsonDecoder.number),
  latitude: JsonDecoder.nullable(JsonDecoder.number),
  altitude: JsonDecoder.nullable(JsonDecoder.number),
  location: JsonDecoder.nullable(JsonDecoder.string),
  city: JsonDecoder.nullable(JsonDecoder.string),
  state: JsonDecoder.nullable(JsonDecoder.string),
  country: JsonDecoder.nullable(JsonDecoder.string),
  orientation: JsonDecoder.nullable(JsonDecoder.number),
  make: JsonDecoder.nullable(JsonDecoder.string),
  model: JsonDecoder.nullable(JsonDecoder.string),
  lens: JsonDecoder.nullable(JsonDecoder.string),
  photographer: JsonDecoder.nullable(JsonDecoder.string),
  aperture: JsonDecoder.nullable(JsonDecoder.number),
  exposure: JsonDecoder.nullable(JsonDecoder.number),
  iso: JsonDecoder.nullable(JsonDecoder.number),
  focalLength: JsonDecoder.nullable(JsonDecoder.number),
}, "Media");

type RequestType<T extends Api.Method> =
  Api.Signatures[T] extends Api.Signature<infer Request>
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
  [Key in keyof Api.Signatures]: JsonDecoder.Decoder<ResponseType<Key>>;
};

const decoders: ResponseDecoders = {
  [Api.Method.State]: StateDecoder,
  [Api.Method.Login]: StateDecoder,
  [Api.Method.Logout]: StateDecoder,
  [Api.Method.CatalogCreate]: CatalogDecoder,
  [Api.Method.AlbumCreate]: AlbumDecoder,
  [Api.Method.AlbumEdit]: AlbumDecoder,
  [Api.Method.TagCreate]: TagDecoder,
  [Api.Method.TagEdit]: TagDecoder,
  [Api.Method.PersonCreate]: PersonDecoder,
  [Api.Method.PersonEdit]: PersonDecoder,
  [Api.Method.MediaCreate]: MediaDecoder,
};

export function request<T extends Api.Method>(
  method: T,
  ...data: RequestType<T>
): Promise<ResponseType<T>> {
  // @ts-ignore: Bleh
  let request = new JsonRequestData<ResponseType<T>>(data, decoders[method]);

  return makeRequest(Api.HttpMethods[method], method, request);
}
