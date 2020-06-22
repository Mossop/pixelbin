import * as Db from "pixelbin-database";
import { User } from "pixelbin-object-model";

import * as Api from ".";
import { Create, Patch } from ".";
import { AppContext } from "../app";
import { ensureAuthenticated } from "../auth";
import { ApiError, ApiErrorCode } from "../error";

export const createCatalog = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Create<Api.Catalog>): Promise<Api.Catalog> => {
    try {
      return await Db.createCatalog(user.email, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);

export const createAlbum = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Create<Api.Album>): Promise<Api.Album> => {
    try {
      return await Db.createAlbum(user.email, data.catalog, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);

export const editAlbum = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Patch<Api.Album>): Promise<Api.Album> => {
    try {
      return await Db.editAlbum(user.email, data.id, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);

export const createTag = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Create<Api.Tag>): Promise<Api.Tag> => {
    try {
      return await Db.createTag(user.email, data.catalog, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);

export const editTag = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Patch<Api.Tag>): Promise<Api.Tag> => {
    try {
      return await Db.editTag(user.email, data.id, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);
