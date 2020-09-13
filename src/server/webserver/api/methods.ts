import { Api } from "../../../model";
import { getLogger, Obj } from "../../../utils";
import { AppContext } from "../context";
import { ApiError } from "../error";
import {
  testStorage,
  createStorage,
  createCatalog,
  createAlbum,
  editAlbum,
  listAlbum,
  createTag,
  editTag,
  findTag,
  createPerson,
  editPerson,
} from "./catalog";
import * as Decoders from "./decoders";
import { DeBlobbed } from "./decoders";
import {
  getMedia,
  createMedia,
  updateMedia,
  thumbnail,
  relations,
  setMediaPeople,
  deleteMedia,
} from "./media";
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
  [Api.Method.StorageTest]: Decoders.StorageTestRequest,
  [Api.Method.StorageCreate]: Decoders.StorageCreateRequest,
  [Api.Method.CatalogCreate]: Decoders.CatalogCreateRequest,
  [Api.Method.AlbumCreate]: Decoders.AlbumCreateRequest,
  [Api.Method.AlbumEdit]: Decoders.AlbumEditRequest,
  [Api.Method.AlbumList]: Decoders.AlbumListRequest,
  [Api.Method.TagCreate]: Decoders.TagCreateRequest,
  [Api.Method.TagEdit]: Decoders.TagEditRequest,
  [Api.Method.TagFind]: Decoders.TagFindRequest,
  [Api.Method.PersonCreate]: Decoders.PersonCreateRequest,
  [Api.Method.PersonEdit]: Decoders.PersonEditRequest,
  [Api.Method.MediaGet]: Decoders.MediaGetRequest,
  [Api.Method.MediaCreate]: Decoders.MediaCreateRequest,
  [Api.Method.MediaEdit]: Decoders.MediaUpdateRequest,
  [Api.Method.MediaThumbnail]: Decoders.MediaThumbnailRequest,
  [Api.Method.MediaRelations]: Decoders.MediaRelationsRequest,
  [Api.Method.MediaPeople]: Decoders.MediaPersonLocations,
  [Api.Method.MediaDelete]: Decoders.StringArray,
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
  [Api.Method.StorageTest]: testStorage,
  [Api.Method.StorageCreate]: createStorage,
  [Api.Method.CatalogCreate]: createCatalog,
  [Api.Method.AlbumCreate]: createAlbum,
  [Api.Method.AlbumEdit]: editAlbum,
  [Api.Method.AlbumList]: listAlbum,
  [Api.Method.TagCreate]: createTag,
  [Api.Method.TagEdit]: editTag,
  [Api.Method.TagFind]: findTag,
  [Api.Method.PersonCreate]: createPerson,
  [Api.Method.PersonEdit]: editPerson,
  [Api.Method.MediaGet]: getMedia,
  [Api.Method.MediaCreate]: createMedia,
  [Api.Method.MediaEdit]: updateMedia,
  [Api.Method.MediaThumbnail]: thumbnail,
  [Api.Method.MediaRelations]: relations,
  [Api.Method.MediaPeople]: setMediaPeople,
  [Api.Method.MediaDelete]: deleteMedia,
};

const KEY_PARSE = /^(?<part>[^.[]+)(?<indexes>(?:\[\d+\])*)(?:\.(?<rest>.+))?$/;
const INNER_ARRAY_PARSE = /\[(?<index>\d+)\]/g;

function addKeyToObject(obj: Obj, key: string, value: unknown, fullkey: string = key): void {
  const logger = getLogger("formdata");

  logger.trace({ key, obj, value, fullkey }, "Adding value object");
  if (typeof obj != "object") {
    throw new ApiError(Api.ErrorCode.InvalidData, {
      message: `Invalid field '${fullkey}'`,
    });
  }

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
  let indexes = matches.groups?.indexes ?? "";
  let rest = matches.groups?.rest ?? "";

  logger.trace({
    key,
    part,
    indexes,
    rest,
  }, "Matched regex");

  if (indexes.length) {
    let inner = obj;
    let index = part;

    let innerMatches = [...indexes.matchAll(INNER_ARRAY_PARSE)];
    while (innerMatches.length) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let match = innerMatches.shift()!;

      if (!(index in inner)) {
        logger.trace({ index }, "Created array");
        inner[index] = [];
      } else if (!Array.isArray(inner[index])) {
        throw new ApiError(Api.ErrorCode.InvalidData, {
          message: `Invalid repeated field '${fullkey}'.`,
        });
      }

      logger.trace({ index }, "Descending");
      inner = inner[index];
      index = match.groups?.index ?? "";
    }

    if (rest.length) {
      if (!(index in inner)) {
        logger.trace({ index }, "Created object");
        inner[index] = {};
      }

      logger.trace({ index }, "Descending");
      addKeyToObject(inner[index], rest, value, fullkey);
    } else if (index in inner) {
      throw new ApiError(Api.ErrorCode.InvalidData, {
        message: `Invalid repeated field '${fullkey}'.`,
      });
    } else {
      logger.trace({ index }, "Setting value");
      inner[index] = value;
    }
  } else if (rest) {
    if (!(part in obj)) {
      logger.trace({ part }, "Created object");
      obj[part] = {};
    } else if (Array.isArray(obj[part]) || typeof obj[part] != "object") {
      throw new ApiError(Api.ErrorCode.InvalidData, {
        message: `Invalid repeated field '${fullkey}'.`,
      });
    }

    logger.trace({ part }, "Descending");
    addKeyToObject(obj[part], rest, value, fullkey);
  } else if (part in obj) {
    throw new ApiError(Api.ErrorCode.InvalidData, {
      message: `Invalid repeated field '${fullkey}'.`,
    });
  } else {
    logger.trace({ part }, "Setting value");
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
    if (ctx.method.toLocaleUpperCase() != Api.HttpMethods[method] &&
        !(ctx.method.toLocaleUpperCase() == "POST" && Api.HttpMethods[method] != "GET")) {
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
        ctx.logger.trace({ data: ctx.request.query }, "Decoding query");
        body = decodeBody(ctx.request.query);
      } else if (ctx.request.type == "multipart/form-data" &&
        body.json && Object.keys(body).length == 1) {
        try {
          body = JSON.parse(body.json);
        } catch (e) {
          ctx.logger.warn({
            data: body.json,
            exception: e,
          }, "Client provided invalid json data.");
          throw new ApiError(Api.ErrorCode.InvalidData, {
            message: String(e),
          });
        }
      } else if (!ctx.request.type.endsWith("/json")) {
        ctx.logger.trace({ data: body }, "Decoding body");
        body = decodeBody(body);
      }

      let decoded;
      try {
        decoded = await decoder(body, ctx.request["files"]);
      } catch (e) {
        ctx.logger.warn({
          body,
          exception: e,
        }, "Client provided invalid data.");
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
    } else {
      ctx.set("Content-Type", "text/plain");
      ctx.body = "Ok";
    }
  };
}
