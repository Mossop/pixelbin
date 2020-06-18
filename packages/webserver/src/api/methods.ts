import Koa from "koa";
import { JsonDecoder } from "ts.data.json";

import {
  HttpMethods,
  ApiMethodSignature,
  ApiMethodSignatures,
  None,
  ApiMethod,
  State,
  MapOf,
} from ".";

type Context = Koa.ParameterizedContext;
type Next = Koa.Next;

type RequestDecoder<Signature> =
  Signature extends ApiMethodSignature<infer Request, unknown>
    ? Request extends None
      ? undefined
      : JsonDecoder.Decoder<Request>
    : never;

type ResponseType<Type> = {
  [Key in keyof Type]: Type[Key] extends MapOf<infer T>
    ? T[]
    : Type[Key];
};

type ApiHandler<Signature> =
  Signature extends ApiMethodSignature<infer Request, infer Response>
    ? Request extends None
      ? () => ResponseType<Response>
      : (item: Request) => ResponseType<Response>
    : never;

type RequestDecoders = {
  [Key in keyof ApiMethodSignatures]: RequestDecoder<ApiMethodSignatures[Key]>;
};

export const apiDecoders: RequestDecoders = {
  state: undefined,
};

type ApiInterface = {
  [Key in keyof ApiMethodSignatures]: ApiHandler<ApiMethodSignatures[Key]>;
};

export const apiMethods: ApiInterface = {
  [ApiMethod.State]: (): State => {
    return { user: null };
  },
};

export function apiRequestHandler(method: ApiMethod): (ctx: Context) => Promise<void> {
  return async (ctx: Context): Promise<void> => {
    if (ctx.method.toLocaleUpperCase() != HttpMethods[method]) {
      throw new Error("Invalid method.");
    }

    let decoder = apiDecoders[method];
    let response: unknown;
    if (decoder) {
      let param = await decoder.decode(ctx.request.body);
      response = apiMethods[method](ctx, param);
    } else {
      response = apiMethods[method](ctx);
    }

    ctx.set("Content-Type", "application/json");
    ctx.body = JSON.stringify(response);
  };
}
