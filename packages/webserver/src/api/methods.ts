import Koa from "koa";
import { Primitive } from "pixelbin-utils";
import { JsonDecoder } from "ts.data.json";

import * as Api from ".";

type Context = Koa.ParameterizedContext;

type RequestDecoder<Signature> =
  Signature extends Api.Signature<infer Request, unknown>
    ? Request extends Api.None
      ? undefined
      : JsonDecoder.Decoder<Request>
    : never;

type ResponseType<Type> =
  Type extends Primitive
    ? Type
    : Type extends (infer T)[]
      ? ResponseType<T>[]
      : Type extends Api.MapOf<infer T>
        ? ResponseType<T>[]
        : { [Key in keyof Type]: ResponseType<Type[Key]> };

type ApiHandler<Signature> =
  Signature extends Api.Signature<infer Request, infer Response>
    ? Request extends Api.None
      ? (ctx: Context) => ResponseType<Response>
      : (ctx: Context, item: Request) => ResponseType<Response>
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
  [Api.Method.State]: (): ResponseType<Api.State> => {
    return { user: null };
  },
};

export function apiRequestHandler(method: Api.Method): (ctx: Context) => Promise<void> {
  return async (ctx: Context): Promise<void> => {
    if (ctx.method.toLocaleUpperCase() != Api.HttpMethods[method]) {
      throw new Error("Invalid method.");
    }

    // let decoder = apiDecoders[method];
    let response: unknown;
    // if (decoder) {
    //   let param = await decoder.decode(ctx.request.body);
    //   response = apiMethods[method](ctx, param);
    // } else {
    response = apiMethods[method](ctx);
    // }

    ctx.set("Content-Type", "application/json");
    ctx.body = JSON.stringify(response);
  };
}
