import { Api } from "../../../model";
import { Obj } from "../../../utils";
import { AppContext } from "../context";
import { ApiError } from "../error";
import {
  createCatalog,
  createAlbum,
  editAlbum,
  listAlbum,
  createTag,
  editTag,
  createPerson,
  editPerson,
} from "./catalog";
import * as Decoders from "./decoders";
import { DeBlobbed } from "./decoders";
import { getMedia, createMedia, thumbnail, relations } from "./media";
import { getState, login, logout, signup } from "./state";

export class DirectResponse {
  public constructor(
    public readonly type: string,
    public readonly body: Buffer | NodeJS.ReadableStream,
  ) {
  }
}

type WithArguments = {
  [Method in Api.Method]: Api.SignatureRequest<Method> extends Api.None
    ? never
    : Method;
}[Api.Method];

type RequestDecoders = {
  [Method in WithArguments]: Api.RequestDecoder<DeBlobbed<Api.SignatureRequest<Method>>>;
};

type ResponseType<T> = T extends Blob ? DirectResponse : Api.ResponseFor<T>;

export const apiDecoders: RequestDecoders = {
  [Api.Method.Login]: Decoders.LoginRequest,
  [Api.Method.Signup]: Decoders.SignupRequest,
  [Api.Method.CatalogCreate]: Decoders.CatalogCreateRequest,
  [Api.Method.AlbumCreate]: Decoders.AlbumCreateRequest,
  [Api.Method.AlbumEdit]: Decoders.AlbumEditRequest,
  [Api.Method.AlbumList]: Decoders.AlbumListRequest,
  [Api.Method.TagCreate]: Decoders.TagCreateRequest,
  [Api.Method.TagEdit]: Decoders.TagEditRequest,
  [Api.Method.PersonCreate]: Decoders.PersonCreateRequest,
  [Api.Method.PersonEdit]: Decoders.PersonEditRequest,
  [Api.Method.MediaGet]: Decoders.MediaGetRequest,
  [Api.Method.MediaCreate]: Decoders.MediaCreateRequest,
  [Api.Method.MediaThumbnail]: Decoders.MediaThumbnailRequest,
  [Api.Method.MediaRelations]: Decoders.MediaRelationsRequest,
};

type ApiInterface = {
  [Key in Api.Method]: Api.SignatureRequest<Key> extends Api.None
    ? (ctx: AppContext) => Promise<ResponseType<Api.SignatureResponse<Key>>>
    : (ctx: AppContext, data: DeBlobbed<Api.SignatureRequest<Key>>) =>
    Promise<ResponseType<Api.SignatureResponse<Key>>>;
};

const apiMethods: ApiInterface = {
  [Api.Method.State]: getState,
  [Api.Method.Login]: login,
  [Api.Method.Logout]: logout,
  [Api.Method.Signup]: signup,
  [Api.Method.CatalogCreate]: createCatalog,
  [Api.Method.AlbumCreate]: createAlbum,
  [Api.Method.AlbumEdit]: editAlbum,
  [Api.Method.AlbumList]: listAlbum,
  [Api.Method.TagCreate]: createTag,
  [Api.Method.TagEdit]: editTag,
  [Api.Method.PersonCreate]: createPerson,
  [Api.Method.PersonEdit]: editPerson,
  [Api.Method.MediaGet]: getMedia,
  [Api.Method.MediaCreate]: createMedia,
  [Api.Method.MediaThumbnail]: thumbnail,
  [Api.Method.MediaRelations]: relations,
};

const KEY_PARSE = /^(?<part>[^.[]+)(?:\[(?<index>\d+)\])?(?:\.(?<rest>.+))?$/;

function addKeyToObject(obj: Obj, key: string, value: unknown, fullkey: string = key): void {
  if (key.length == 0) {
    throw new ApiError(Api.ErrorCode.InvalidData, {
      message: `Invalid field '${fullkey}'`,
    });
  }

  let matches = KEY_PARSE.exec(key);

  if (!matches) {
    throw new ApiError(Api.ErrorCode.InvalidData, {
      message: `Invalid field '${fullkey}'.`,
    });
  }

  let part = matches.groups?.part ?? "";
  let index = matches.groups?.index ? parseInt(matches.groups.index) : undefined;
  let rest = matches.groups?.rest;

  if (index !== undefined) {
    if (!(part in obj)) {
      obj[part] = [];
    } else if (!Array.isArray(obj[part])) {
      throw new ApiError(Api.ErrorCode.InvalidData, {
        message: `Invalid repeated field '${fullkey}'.`,
      });
    }

    if (rest) {
      let inner = {};
      obj[part][index] = inner;
      addKeyToObject(inner, rest, value, fullkey);
    } else {
      obj[part][index] = value;
    }
  } else if (rest) {
    if (!(part in obj)) {
      obj[part] = {};
    } else if (Array.isArray(obj[part]) || typeof obj[part] != "object") {
      throw new ApiError(Api.ErrorCode.InvalidData, {
        message: `Invalid repeated field '${fullkey}'.`,
      });
    }

    addKeyToObject(obj[part], rest, value, fullkey);
  } else {
    obj[part] = value;
  }
}

export function decodeBody(body: Obj): Obj {
  let result = {};

  for (let [key, value] of Object.entries(body)) {
    addKeyToObject(result, key, value);
  }

  return result;
}

export function apiRequestHandler<T extends Api.Method>(
  method: T,
): (ctx: AppContext) => Promise<void> {
  return async (ctx: AppContext): Promise<void> => {
    if (ctx.method.toLocaleUpperCase() != Api.HttpMethods[method]) {
      throw new ApiError(Api.ErrorCode.BadMethod, {
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

      let body = ctx.request["body"];
      if (ctx.request.method == "GET") {
        body = decodeBody(ctx.request.query);
      } else if (!ctx.request.type.endsWith("/json")) {
        body = decodeBody(body);
      }

      let decoded;
      try {
        decoded = await decoder(body, ctx.request["files"]);
      } catch (e) {
        ctx.logger.warn(e, "Client provided invalid data.");
        throw new ApiError(Api.ErrorCode.InvalidData, {
          message: String(e),
        });
      }

      response = await apiMethod(ctx, decoded);
    }

    if (response) {
      if (response instanceof DirectResponse) {
        ctx.set("Content-Type", response.type);
        ctx.body = response.body;
      } else {
        ctx.set("Content-Type", "application/json");
        ctx.body = JSON.stringify(response);
      }
    }
  };
}
