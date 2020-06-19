import Koa from "koa";
import { listCatalogs, listPeople, listTags, listAlbums } from "pixelbin-database";

import { State, User } from ".";

type Context = Koa.ParameterizedContext;

export async function buildUser(_ctx: Context): Promise<User | null> {
  return {
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    hadCatalog: false,
    verified: true,
    catalogs: await listCatalogs("dtownsend@oxymoronical.com"),
    people: await listPeople("dtownsend@oxymoronical.com"),
    tags: await listTags("dtownsend@oxymoronical.com"),
    albums: await listAlbums("dtownsend@oxymoronical.com"),
  };
}

export async function buildState(ctx: Context): Promise<State> {
  return {
    user: await buildUser(ctx),
  };
}
