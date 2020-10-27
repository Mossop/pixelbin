import type { Api, Query, ResponseFor } from "../../../model";
import { isoDateTime, isDateTime } from "../../../utils";
import type { Tables } from "../../database/types";
import type { AppContext } from "../context";

function queryIntoResponse(query: Query): ResponseFor<Query> {
  if (query.type == "field") {
    if (isDateTime(query.value)) {
      return {
        ...query,
        value: isoDateTime(query.value),
      };
    } else {
      // @ts-ignore
      return query;
    }
  } else {
    return {
      ...query,
      queries: query.queries.map(queryIntoResponse),
    };
  }
}

export function savedSearchIntoResponse(search: Api.SavedSearch): ResponseFor<Api.SavedSearch> {
  return {
    ...search,
    query: queryIntoResponse(search.query),
  };
}

export async function buildUser(ctx: AppContext): Promise<ResponseFor<Api.User> | null> {
  if (!ctx.user) {
    return null;
  }

  let userDb = ctx.dbConnection.forUser(ctx.user);

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

  let user = await userDb.getUser();

  return {
    ...user,
    created: isoDateTime(user.created),
    storage: apiStores,
    catalogs: await userDb.listCatalogs(),
    people: await userDb.listPeople(),
    tags: await userDb.listTags(),
    albums: await userDb.listAlbums(),
    searches: (await userDb.listSavedSearches()).map(savedSearchIntoResponse),
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
