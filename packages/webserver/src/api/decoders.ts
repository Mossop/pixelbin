import { JsonDecoder } from "ts.data.json";

import { LoginRequest } from ".";

export const LoginRequestDecoder = JsonDecoder.object<LoginRequest>({
  email: JsonDecoder.string,
  password: JsonDecoder.string,
}, "LoginRequest");
