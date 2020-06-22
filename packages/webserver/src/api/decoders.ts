import { JsonDecoder } from "ts.data.json";

import * as Api from ".";

export const LoginRequest = JsonDecoder.object<Api.LoginRequest>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
}, "LoginRequest");

export const CatalogCreateRequest = JsonDecoder.object<Api.CatalogCreateRequest>({
  name: JsonDecoder.string,
}, "CatalogCreateReqeust");

export const AlbumCreateRequest = JsonDecoder.object<Api.AlbumCreateRequest>({
  catalog: JsonDecoder.string,
  name: JsonDecoder.string,
  stub: JsonDecoder.nullable(JsonDecoder.string),
  parent: JsonDecoder.nullable(JsonDecoder.string),
}, "AlbumCreateRequest");

export const AlbumEditRequest = JsonDecoder.object<Api.AlbumEditRequest>({
  id: JsonDecoder.string,
  name: JsonDecoder.optional(JsonDecoder.string),
  stub: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
  parent: JsonDecoder.optional(JsonDecoder.nullable(JsonDecoder.string)),
}, "AlbumEditRequest");
