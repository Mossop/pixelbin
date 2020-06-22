import { JsonDecoder } from "ts.data.json";

import * as Api from ".";
import { Create, Patch } from ".";

export const LoginRequest = JsonDecoder.object<Api.LoginRequest>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
}, "LoginRequest");

export const CatalogCreateRequest = JsonDecoder.object<Create<Api.Catalog>>({
  name: JsonDecoder.string,
}, "CatalogCreateReqeust");

export const AlbumCreateRequest = JsonDecoder.object<Create<Api.Album>>({
  catalog: JsonDecoder.string,
  name: JsonDecoder.string,
  stub: JsonDecoder.nullable(JsonDecoder.string),
  parent: JsonDecoder.nullable(JsonDecoder.string),
}, "AlbumCreateRequest");

export const AlbumEditRequest = JsonDecoder.object<Patch<Api.Album>>({
  id: JsonDecoder.string,
  name: JsonDecoder.optional(JsonDecoder.string),
  stub: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  parent: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
}, "AlbumEditRequest");

export const TagCreateRequest = JsonDecoder.object<Create<Api.Tag>>({
  catalog: JsonDecoder.string,
  name: JsonDecoder.string,
  parent: JsonDecoder.nullable(JsonDecoder.string),
}, "TagCreateRequest");

export const TagEditRequest = JsonDecoder.object<Patch<Api.Tag>>({
  id: JsonDecoder.string,
  name: JsonDecoder.optional(JsonDecoder.string),
  parent: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
}, "TagEditRequest");

export const PersonCreateRequest = JsonDecoder.object<Create<Api.Person>>({
  catalog: JsonDecoder.string,
  name: JsonDecoder.string,
}, "PersonCreateRequest");

export const PersonEditRequest = JsonDecoder.object<Patch<Api.Person>>({
  id: JsonDecoder.string,
  name: JsonDecoder.optional(JsonDecoder.string),
}, "PersonEditRequest");
