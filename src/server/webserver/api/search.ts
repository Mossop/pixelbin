import type { Query, Api, ResponseFor } from "../../../model";
import { isCompoundQuery } from "../../../model";
import { isDateTime, isoDateTime } from "../../../utils";
import type { UserScopedConnection } from "../../database";
import { ensureAuthenticated } from "../auth";
import type { AppContext } from "../context";
import { buildResponseMedia } from "./media";

export const searchMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    search: Api.MediaSearchRequest,
  ): Promise<ResponseFor<Api.Media>[]> => {
    let media = await userDb.searchMedia(search.catalog, search.query);
    return media.map(buildResponseMedia);
  },
);

function queryResponse(query: Query): ResponseFor<Query> {
  if (isCompoundQuery(query)) {
    return {
      ...query,
      queries: query.queries.map(queryResponse),
    };
  }

  if (isDateTime(query.value)) {
    return {
      ...query,
      value: isoDateTime(query.value),
    };
  }

  return query as ResponseFor<Query>;
}

export const createSavedSearch = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    search: Api.Create<Api.SavedSearch>,
  ): Promise<ResponseFor<Api.SavedSearch>> => {
    let saved = await userDb.createSavedSearch(search);
    return {
      ...saved,
      query: queryResponse(saved.query),
    };
  },
);

export const editSavedSearch = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    search: Api.Patch<Api.SavedSearch>,
  ): Promise<ResponseFor<Api.SavedSearch>> => {
    let saved = await userDb.editSavedSearch(search.id, search);
    return {
      ...saved,
      query: queryResponse(saved.query),
    };
  },
);

export const deleteSavedSearch = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    searches: string[],
  ): Promise<void> => {
    await userDb.deleteSavedSearch(searches);
  },
);
