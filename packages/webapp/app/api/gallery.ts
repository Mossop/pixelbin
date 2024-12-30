import { getRequestContext } from "@/modules/RequestContext";
import { safeLoader } from "@/modules/actions";
import { isMediaSource, listMedia, searchMedia } from "@/modules/api";
import { SearchQuery } from "@/modules/types";

import { Route } from "./+types/gallery";

export const loader = safeLoader(
  async ({
    request,
    context,
    params: { container, id, type },
  }: Route.LoaderArgs) => {
    if (!isMediaSource(container)) {
      throw new Error(`Unknown container: ${container}`);
    }

    let requestContext = await getRequestContext(request, context);

    if (type == "media") {
      return listMedia(requestContext, container, id);
    }

    if (type == "search") {
      let url = new URL(request.url);
      let param = url.searchParams.get("q");
      if (!param) {
        throw new Error("No search query specified");
      }

      let query = JSON.parse(param) as unknown as SearchQuery;
      return searchMedia(requestContext, id, query);
    }

    throw new Error(`Unknown lookup type: ${type}`);
  },
);
