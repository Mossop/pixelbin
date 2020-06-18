import { Primitive } from "pixelbin-utils";
import * as Api from "pixelbin-webserver/build/api";
import { JsonDecoder } from "ts.data.json";

import { ReadonlyMapDecoder } from "../utils/decoders";
import { ReadonlyMapOf } from "../utils/maps";

type ClientState<Type> =
  Type extends Primitive
    ? Type
    : Type extends (infer T)[]
      ? readonly ClientState<T>[]
      : Type extends Api.MapOf<infer T>
        ? ReadonlyMapOf<ClientState<T>>
        : { readonly [Key in keyof Type]: ClientState<Type[Key]> };

const PersonStateDecoder = JsonDecoder.object<ClientState<Api.PersonState>>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    name: JsonDecoder.string,
  },
  "PersonState",
);

const TagStateDecoder = JsonDecoder.object<ClientState<Api.TagState>>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    parent: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    name: JsonDecoder.string,
  },
  "TagState",
);

const AlbumStateDecoder = JsonDecoder.object<ClientState<Api.AlbumState>>(
  {
    id: JsonDecoder.string,
    catalog: JsonDecoder.string,
    stub: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
    name: JsonDecoder.string,
    parent: JsonDecoder.oneOf([JsonDecoder.string, JsonDecoder.isNull(null)], "string | null"),
  },
  "AlbumState",
);

const CatalogStateDecoder = JsonDecoder.object<ClientState<Api.CatalogState>>(
  {
    id: JsonDecoder.string,
    name: JsonDecoder.string,
    people: ReadonlyMapDecoder(PersonStateDecoder, "ReadonlyMapOf<PersonData>"),
    tags: ReadonlyMapDecoder(TagStateDecoder, "ReadonlyMapOf<TagData>"),
    albums: ReadonlyMapDecoder(AlbumStateDecoder, "ReadonlyMapOf<AlbumData>"),
  },
  "CatalogState",
);

const UserStateDecoder = JsonDecoder.object<ClientState<Api.UserState>>(
  {
    id: JsonDecoder.string,
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
    hadCatalog: JsonDecoder.boolean,
    verified: JsonDecoder.boolean,
    catalogs: ReadonlyMapDecoder(CatalogStateDecoder, "ReadonlyMapOf<CatalogData>"),
  },
  "UserState",
);

const StateDecoder = JsonDecoder.object<ClientState<Api.State>>(
  {
    user: JsonDecoder.oneOf([UserStateDecoder, JsonDecoder.isNull(null)], "string | null"),
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
    ? JsonDecoder.Decoder<ClientState<Response>>
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
