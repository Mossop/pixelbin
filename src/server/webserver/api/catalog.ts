import { Api, ObjectModel, Create, Patch } from "../../../model";
import { AppContext } from "../app";
import { ensureAuthenticated } from "../auth";
import { ApiError, ApiErrorCode } from "../error";

export const createCatalog = ensureAuthenticated(
  async (
    ctx: AppContext,
    user: ObjectModel.User,
    data: Api.CatalogCreateRequest,
  ): Promise<Api.Catalog> => {
    let userDb = ctx.dbConnection.forUser(user.email);

    try {
      let catalogData: Create<Api.Catalog>;
      if (typeof data.storage != "string") {
        let storage = await userDb.createStorage(data.storage);
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

      return await userDb.createCatalog(catalogData);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
      });
    }
  },
);

export const createAlbum = ensureAuthenticated(
  async (ctx: AppContext, user: ObjectModel.User, data: Create<Api.Album>): Promise<Api.Album> => {
    let userDb = ctx.dbConnection.forUser(user.email);

    try {
      return await userDb.createAlbum(data.catalog, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
      });
    }
  },
);

export const editAlbum = ensureAuthenticated(
  async (ctx: AppContext, user: ObjectModel.User, data: Patch<Api.Album>): Promise<Api.Album> => {
    let userDb = ctx.dbConnection.forUser(user.email);

    try {
      return await userDb.editAlbum(data.id, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
      });
    }
  },
);

export const createTag = ensureAuthenticated(
  async (ctx: AppContext, user: ObjectModel.User, data: Create<Api.Tag>): Promise<Api.Tag> => {
    let userDb = ctx.dbConnection.forUser(user.email);

    try {
      return await userDb.createTag(data.catalog, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
      });
    }
  },
);

export const editTag = ensureAuthenticated(
  async (ctx: AppContext, user: ObjectModel.User, data: Patch<Api.Tag>): Promise<Api.Tag> => {
    let userDb = ctx.dbConnection.forUser(user.email);

    try {
      return await userDb.editTag(data.id, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
      });
    }
  },
);

export const createPerson = ensureAuthenticated(
  async (
    ctx: AppContext,
    user: ObjectModel.User,
    data: Create<Api.Person>,
  ): Promise<Api.Person> => {
    let userDb = ctx.dbConnection.forUser(user.email);

    try {
      return await userDb.createPerson(data.catalog, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
      });
    }
  },
);

export const editPerson = ensureAuthenticated(
  async (ctx: AppContext, user: ObjectModel.User, data: Patch<Api.Person>): Promise<Api.Person> => {
    let userDb = ctx.dbConnection.forUser(user.email);

    try {
      return await userDb.editPerson(data.id, data);
    } catch (e) {
      throw new ApiError(ApiErrorCode.InvalidData, {
        message: String(e),
      });
    }
  },
);
