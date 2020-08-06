import { Api } from "../../../model";
import { AppContext } from "../context";
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
import { DeBlobbed } from "./decoders";
import { createMedia } from "./media";
import { getState, login, logout } from "./state";

type WithArguments = {
  [Method in Api.Method]: Api.SignatureRequest<Method> extends Api.None
    ? never
    : Method;
}[Api.Method];

type RequestDecoders = {
  [Key in WithArguments]: Api.RequestDecoder<DeBlobbed<Api.SignatureRequest<Key>>>;
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
  [Api.Method.MediaCreate]: Decoders.MediaCreateRequest,
};

type ApiInterface = {
  [Key in Api.Method]: Api.SignatureRequest<Key> extends Api.None
    ? (ctx: AppContext) => Promise<Api.SignatureResponse<Key>>
    : (ctx: AppContext, data: DeBlobbed<Api.SignatureRequest<Key>>) =>
    Promise<Api.SignatureResponse<Key>>;
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
  [Api.Method.MediaCreate]: createMedia,
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
      // @ts-ignore: TypeScript is falling over here.
      let decoder: RequestDecoder<DeBlobbed<Api.SignatureRequest<T>>> = apiDecoders[method];
      // @ts-ignore: TypeScript is falling over here.
      let apiMethod: (
        ctx: AppContext, data: Api.SignatureRequest<T>,
      ) => Promise<unknown> = apiMethods[method];

      let decoded;
      try {
        decoded = await decoder(ctx.request.body, ctx.request.files);
      } catch (e) {
        ctx.logger.warn(e, "Client provided invalid data.");
        throw new ApiError(ApiErrorCode.InvalidData, {
          message: String(e),
        });
      }

      response = await apiMethod(ctx, decoded);
    }

    if (response) {
      ctx.set("Content-Type", "application/json");
      ctx.body = JSON.stringify(response);
    }
  };
}
