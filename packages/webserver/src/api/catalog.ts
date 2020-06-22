import * as Db from "pixelbin-database";
import { User } from "pixelbin-object-model";

import { CatalogCreateRequest, Catalog, AlbumCreateRequest, Album } from ".";
import { AppContext } from "../app";
import { ensureAuthenticated } from "../auth";
import { ApiError, ApiErrorCode } from "../error";

export const createCatalog = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: CatalogCreateRequest): Promise<Catalog> => {
    return Db.createCatalog(user.email, data);
  },
);

export const createAlbum = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: AlbumCreateRequest): Promise<Album> => {
    try {
      return await Db.createAlbum(user.email, data.catalog, data);
    } catch (e) {
      // For the moment just assume that the user or catalog were invalid.
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);
