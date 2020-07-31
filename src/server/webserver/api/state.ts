import { Api } from "../../../model";
import * as Db from "../../database";
import { AppContext } from "../app";

export async function buildUser(ctx: AppContext): Promise<Api.User | null> {
  if (!ctx.user) {
    return null;
  }

  return {
    ...ctx.user,
    catalogs: await Db.listCatalogs(ctx.user.email),
    people: await Db.listPeople(ctx.user.email),
    tags: await Db.listTags(ctx.user.email),
    albums: await Db.listAlbums(ctx.user.email),
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
