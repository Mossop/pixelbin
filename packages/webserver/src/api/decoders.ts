import { JsonDecoder } from "ts.data.json";

import * as Api from ".";

export const LoginRequest = JsonDecoder.object<Api.LoginRequest>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
}, "LoginRequest");

export const CatalogCreateRequest = JsonDecoder.object<Api.CatalogCreateRequest>({
  name: JsonDecoder.string,
}, "CatalogCreateReqeust");
