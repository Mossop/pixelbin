import { Api } from "../../../model";
import { AppContext } from "../context";

export async function buildUser(ctx: AppContext): Promise<Api.User | null> {
  if (!ctx.user) {
    return null;
  }

  let userDb = ctx.dbConnection.forUser(ctx.user.email);

  return {
    ...ctx.user,
    catalogs: await userDb.listCatalogs(),
    people: await userDb.listPeople(),
    tags: await userDb.listTags(),
    albums: await userDb.listAlbums(),
  };
}

async function buildState(ctx: AppContext): Promise<Api.State> {
  return {
    user: await buildUser(ctx),
  };
}

export async function getState(ctx: AppContext): Promise<Api.State> {
  return buildState(ctx);
}

export async function login(ctx: AppContext, data: Api.LoginRequest): Promise<Api.State> {
  await ctx.login(data.email, data.password);

  return buildState(ctx);
}

export async function logout(ctx: AppContext): Promise<Api.State> {
  await ctx.logout();

  return buildState(ctx);
}

export async function signup(ctx: AppContext, data: Api.SignupRequest): Promise<Api.State> {
  await ctx.dbConnection.createUser(data);
  await ctx.login(data.email, data.password);

  return buildState(ctx);
}
