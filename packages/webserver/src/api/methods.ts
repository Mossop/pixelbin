import Koa from "koa";
import { JsonDecoder } from "ts.data.json";

import * as Api from ".";
import { getState } from "./state";

type Context = Koa.ParameterizedContext;

type RequestDecoder<Signature> =
  Signature extends Api.Signature<infer Request, unknown>
    ? Request extends Api.None
      ? undefined
      : JsonDecoder.Decoder<Request>
    : never;

type ApiHandler<Signature> =
  Signature extends Api.Signature<infer Request, infer Response>
    ? Request extends Api.None
      ? (ctx: Context) => Promise<Response>
      : (ctx: Context, item: Request) => Promise<Response>
    : never;

type RequestDecoders = {
  [Key in keyof Api.Signatures]: RequestDecoder<Api.Signatures[Key]>;
};

export const apiDecoders: RequestDecoders = {
  state: undefined,
};

type ApiInterface = {
  [Key in keyof Api.Signatures]: ApiHandler<Api.Signatures[Key]>;
};

export const apiMethods: ApiInterface = {
  [Api.Method.State]: getState,
};

export function apiRequestHandler<T extends Api.Method>(
  method: T,
): (ctx: Context) => Promise<void> {
  return async (ctx: Context): Promise<void> => {
    if (ctx.method.toLocaleUpperCase() != Api.HttpMethods[method]) {
      throw new Error("Invalid method.");
    }

    let response = await apiMethods[method](ctx);

    ctx.set("Content-Type", "application/json");
    ctx.body = JSON.stringify(response);
  };
}
