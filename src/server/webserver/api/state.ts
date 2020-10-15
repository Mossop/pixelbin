import { Api, ResponseFor } from "../../../model";
import { Tables } from "../../database/types";
import { AppContext } from "../context";

export async function buildUser(ctx: AppContext): Promise<ResponseFor<Api.User> | null> {
  if (!ctx.user) {
    return null;
  }

  let userDb = ctx.dbConnection.forUser(ctx.user.email);

  let storage = await userDb.listStorage();
  let apiStores = storage.map((storage: Tables.Storage): Api.Storage => {
    let {
      user,
      accessKeyId,
      secretAccessKey,
      ...rest
    } = storage;

    return rest;
  });

  return {
    ...ctx.user,
    storage: apiStores,
    catalogs: await userDb.listCatalogs(),
    people: await userDb.listPeople(),
    tags: await userDb.listTags(),
    albums: await userDb.listAlbums(),
  };
}

export async function buildState(ctx: AppContext): Promise<ResponseFor<Api.State>> {
  return {
    user: await buildUser(ctx),
  };
}

export async function getState(ctx: AppContext): Promise<ResponseFor<Api.State>> {
  return buildState(ctx);
}

export async function login(
  ctx: AppContext,
  data: Api.LoginRequest,
): Promise<ResponseFor<Api.State>> {
  await ctx.login(data.email, data.password);

  return buildState(ctx);
}

export async function logout(ctx: AppContext): Promise<ResponseFor<Api.State>> {
  await ctx.logout();

  return buildState(ctx);
}

export async function signup(
  ctx: AppContext,
  data: Api.SignupRequest,
): Promise<ResponseFor<Api.State>> {
  await ctx.dbConnection.createUser(data);
  await ctx.login(data.email, data.password);

  return buildState(ctx);
}
