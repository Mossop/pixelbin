import type { Query, Api, ApiSerialization, Requests } from "../../../model";
import { isCompoundQuery } from "../../../model";
import { isDateTime, isoDateTime } from "../../../utils";
import type { MediaView, UserScopedConnection } from "../../database";
import { ensureAuthenticated } from "../auth";
import type { AppContext } from "../context";
import { buildResponseMedia } from "./media";

export const searchMedia = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    search: Requests.MediaSearch,
  ): Promise<ApiSerialization<Api.Media>[]> => {
    let media = await userDb.searchMedia(search.catalog, search.query);
    return media.map(buildResponseMedia);
  },
);

function queryResponse(query: Query): ApiSerialization<Query> {
  if (isCompoundQuery(query)) {
    return {
      ...query,
      queries: query.queries.map(queryResponse),
    };
  }

  return {
    ...query,
    value: isDateTime(query.value) ? isoDateTime(query.value) : query.value,
  };
}

export const createSavedSearch = ensureAuthenticated(
  async (
    ctx: AppContext,
    userDb: UserScopedConnection,
    data: Requests.SavedSearchCreate,
  ): Promise<ApiSerialization<Api.SavedSearch>> => {
    let saved = await userDb.createSavedSearch(data.catalog, data.search);
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
    data: Requests.SavedSearchEdit,
  ): Promise<ApiSerialization<Api.SavedSearch>> => {
    let saved = await userDb.editSavedSearch(data.id, data.search);
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
    await userDb.deleteSavedSearches(searches);
  },
);

export async function sharedSearch(
  ctx: AppContext,
  data: Requests.SharedSearch,
): Promise<ApiSerialization<Api.SharedSearchResults | null>> {
  let buildSharedMedia = (
    media: MediaView,
  ): ApiSerialization<Api.SharedMediaWithMetadata> | null => {
    if (!media.file) {
      return null;
    }

    let {
      catalog,
      ...shared
    } = buildResponseMedia(media);

    // @ts-ignore: The initial check should ensure this is correct.
    return shared;
  };

  let isMedia = (
    item: ApiSerialization<Api.SharedMedia> | null,
  ): item is ApiSerialization<Api.SharedMedia> => {
    return !!item;
  };

  let results = await ctx.dbConnection.sharedSearch(data.id);
  return {
    name: results.name,
    // @ts-ignore
    media: results.media.map(buildSharedMedia).filter(isMedia),
  };
}
