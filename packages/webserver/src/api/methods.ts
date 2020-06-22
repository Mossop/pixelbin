import { JsonDecoder } from "ts.data.json";

import * as Api from ".";
import { AppContext } from "../app";
import { ApiError, ApiErrorCode } from "../error";
import {
  createCatalog,
  createAlbum,
  editAlbum,
  createTag,
  editTag,
  createPerson,
  editPerson,
} from "./catalog";
import * as Decoders from "./decoders";
import { getState, login, logout } from "./state";

type WithArguments = {
  [Method in Api.Method]: Api.SignatureRequest<Method> extends Api.None
    ? never
    : Method;
}[Api.Method];

type RequestDecoders = {
  [Key in WithArguments]: JsonDecoder.Decoder<Api.SignatureRequest<Key>>;
};

export const apiDecoders: RequestDecoders = {
  [Api.Method.Login]: Decoders.LoginRequest,
  [Api.Method.CatalogCreate]: Decoders.CatalogCreateRequest,
  [Api.Method.AlbumCreate]: Decoders.AlbumCreateRequest,
  [Api.Method.AlbumEdit]: Decoders.AlbumEditRequest,
  [Api.Method.TagCreate]: Decoders.TagCreateRequest,
  [Api.Method.TagEdit]: Decoders.TagEditRequest,
  [Api.Method.PersonCreate]: Decoders.PersonCreateRequest,
  [Api.Method.PersonEdit]: Decoders.PersonEditRequest,
};

type ApiInterface = {
  [Key in Api.Method]: Api.SignatureRequest<Key> extends Api.None
    ? (ctx: AppContext) => Promise<Api.SignatureResponse<Key>>
    : (ctx: AppContext, data: Api.SignatureRequest<Key>) => Promise<Api.SignatureResponse<Key>>;
};

const apiMethods: ApiInterface = {
  [Api.Method.State]: getState,
  [Api.Method.Login]: login,
  [Api.Method.Logout]: logout,
  [Api.Method.CatalogCreate]: createCatalog,
  [Api.Method.AlbumCreate]: createAlbum,
  [Api.Method.AlbumEdit]: editAlbum,
  [Api.Method.TagCreate]: createTag,
  [Api.Method.TagEdit]: editTag,
  [Api.Method.PersonCreate]: createPerson,
  [Api.Method.PersonEdit]: editPerson,
};

export function apiRequestHandler<T extends Api.Method>(
  method: T,
): (ctx: AppContext) => Promise<void> {
  return async (ctx: AppContext): Promise<void> => {
    if (ctx.method.toLocaleUpperCase() != Api.HttpMethods[method]) {
      throw new ApiError(ApiErrorCode.BadMethod, {
        received: ctx.method,
        expected: Api.HttpMethods[method],
      });
    }

    let response: unknown = undefined;
    if (!(method in apiDecoders)) {
      // @ts-ignore: TypeScript is falling over here.
      let apiMethod: (ctx: Context) => Promise<unknown> = apiMethods[method];
      response = await apiMethod(ctx);
    } else {
      let body = ctx.request.body;
      if (!Array.isArray(body) && typeof body == "object" && ctx.request.files) {
        for (let [key, file] of Object.entries(ctx.request.files)) {
          body[key] = file;
        }
      }

      // @ts-ignore: TypeScript is falling over here.
      let decoder: JsonDecoder.Decoder<Api.SignatureRequest<T>> = apiDecoders[method];
      // @ts-ignore: TypeScript is falling over here.
      let apiMethod: (
        ctx: AppContext, data: Api.SignatureRequest<T>,
      ) => Promise<unknown> = apiMethods[method];

      let decoded;
      try {
        decoded = await decoder.decodePromise(body);
      } catch (e) {
        ctx.logger.warn(e, "Client provided invalid data.");
        throw new ApiError(ApiErrorCode.InvalidData);
      }

      response = await apiMethod(ctx, decoded);
    }

    if (response) {
      ctx.set("Content-Type", "application/json");
      ctx.body = JSON.stringify(response);
    }
  };
}
