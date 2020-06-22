import * as Db from "pixelbin-database";
import { User } from "pixelbin-object-model";

import * as Api from ".";
import { AppContext } from "../app";
import { ensureAuthenticated } from "../auth";
import { ApiError, ApiErrorCode } from "../error";

export const createCatalog = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Api.CatalogCreateRequest): Promise<Api.Catalog> => {
    try {
      return await Db.createCatalog(user.email, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);

export const createAlbum = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Api.AlbumCreateRequest): Promise<Api.Album> => {
    try {
      return await Db.createAlbum(user.email, data.catalog, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);

export const editAlbum = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Api.AlbumEditRequest): Promise<Api.Album> => {
    try {
      return await Db.editAlbum(user.email, data.id, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);
