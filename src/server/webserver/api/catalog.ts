import { Api, Create, Patch } from "../../../model";
import { UserScopedConnection } from "../../database";
import { ensureAuthenticated } from "../auth";
import { AppContext } from "../context";

export const createCatalog = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Api.CatalogCreateRequest,
  ): Promise<Api.Catalog> => {
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

    return userDb.createCatalog(catalogData);
  },
);

export const createAlbum = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Create<Api.Album>,
  ): Promise<Api.Album> => {
    return userDb.createAlbum(data.catalog, data);
  },
);

export const editAlbum = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Patch<Api.Album>,
  ): Promise<Api.Album> => {
    return userDb.editAlbum(data.id, data);
  },
);

export const createTag = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Create<Api.Tag>,
  ): Promise<Api.Tag> => {
    return userDb.createTag(data.catalog, data);
  },
);

export const editTag = ensureAuthenticated(
  async (ctx: AppContext, userDb: UserScopedConnection, data: Patch<Api.Tag>): Promise<Api.Tag> => {
    return userDb.editTag(data.id, data);
  },
);

export const createPerson = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Create<Api.Person>,
  ): Promise<Api.Person> => {
    return userDb.createPerson(data.catalog, data);
  },
);

export const editPerson = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Patch<Api.Person>,
  ): Promise<Api.Person> => {
    return userDb.editPerson(data.id, data);
  },
);
