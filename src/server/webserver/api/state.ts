import type { Api, Query, ApiSerialization, Requests } from "../../../model";
import { isoDateTime, isDateTime } from "../../../utils";
import type { Tables } from "../../database/types";
import type { AppContext } from "../context";

function queryIntoResponse(query: Query): ApiSerialization<Query> {
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

export function savedSearchIntoResponse(
  search: Api.SavedSearch,
): ApiSerialization<Api.SavedSearch> {
  return {
    ...search,
    query: queryIntoResponse(search.query),
  };
}

export async function buildUser(ctx: AppContext): Promise<ApiSerialization<Api.User> | null> {
  if (!ctx.user) {
    return null;
  }

  let userDb = ctx.dbConnection.forUser(ctx.user);

  let storage = await userDb.listStorage();
  let apiStores = storage.map((storage: Tables.Storage): Api.Storage => {
    let {
      owner,
      accessKeyId,
      secretAccessKey,
      ...rest
    } = storage;

    return rest;
  });

  let user = await userDb.getUser();

  return {
    ...user,
    lastLogin: user.lastLogin ? isoDateTime(user.lastLogin) : null,
    created: isoDateTime(user.created),
    storage: apiStores,
    catalogs: await userDb.listCatalogs(),
    people: await userDb.listPeople(),
    tags: await userDb.listTags(),
    albums: await userDb.listAlbums(),
    searches: (await userDb.listSavedSearches()).map(savedSearchIntoResponse),
  };
}

export async function buildState(ctx: AppContext): Promise<ApiSerialization<Api.State>> {
  return {
    user: await buildUser(ctx),
  };
}

export async function getState(ctx: AppContext): Promise<ApiSerialization<Api.State>> {
  return buildState(ctx);
}

export async function login(
  ctx: AppContext,
  data: Requests.Login,
): Promise<ApiSerialization<Api.State>> {
  await ctx.login(data.email, data.password);

  return buildState(ctx);
}

export async function logout(ctx: AppContext): Promise<ApiSerialization<Api.State>> {
  await ctx.logout();

  return buildState(ctx);
}

export async function signup(
  ctx: AppContext,
  data: Requests.Signup,
): Promise<ApiSerialization<Api.State>> {
  await ctx.dbConnection.createUser(data);
  await ctx.login(data.email, data.password);

  return buildState(ctx);
}
