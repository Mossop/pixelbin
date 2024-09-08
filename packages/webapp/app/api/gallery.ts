import { LoaderFunctionArgs } from "@remix-run/node";

import { getRequestContext } from "@/modules/RequestContext";
import { safeLoader } from "@/modules/actions";
import { listMedia, searchMedia } from "@/modules/api";

export const loader = safeLoader(
  async ({
    request,
    context,
    params: { container, id, type },
  }: LoaderFunctionArgs) => {
    if (!["catalog", "album", "search"].includes(container!)) {
      throw new Error(`Unknown container: ${container}`);
    }

    let session = await getRequestContext(request, context);

    if (type == "media") {
      return listMedia(
        session,
        // @ts-ignore
        container!,
        id!,
      );
    }

    if (type == "search") {
      let url = new URL(request.url);
      let param = url.searchParams.get("q");
      if (!param) {
        throw new Error("No search query specified");
      }

      let query = JSON.parse(param);
      return searchMedia(session, id!, query);
    }

    throw new Error(`Unknown lookup type: ${type}`);
  },
);
