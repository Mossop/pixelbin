
import { Create, Patch } from "../../../model/api";
import * as Api from "../../../model/api";
import { User } from "../../../model/models";
import * as Db from "../../database";
import { AppContext } from "../app";
import { ensureAuthenticated } from "../auth";
import { ApiError, ApiErrorCode } from "../error";

export const createCatalog = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Api.CatalogCreateRequest): Promise<Api.Catalog> => {
    try {
      let catalogData: Create<Api.Catalog>;
      if (typeof data.storage != "string") {
        let storage = await Db.createStorage(data.storage);
        catalogData = {
          ...data,
          storage: storage.id,
        };
      } else {
        catalogData = {
          ...data,
          storage: data.storage,
        };
      }

      return await Db.createCatalog(user.email, catalogData);
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

export const createPerson = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Create<Api.Person>): Promise<Api.Person> => {
    try {
      return await Db.createPerson(user.email, data.catalog, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);

export const editPerson = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: Patch<Api.Person>): Promise<Api.Person> => {
    try {
      return await Db.editPerson(user.email, data.id, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData);
    }
  },
);
