import { LoaderFunctionArgs } from "@remix-run/node";

import { safeLoader } from "@/modules/actions";
import { listMedia, searchMedia } from "@/modules/api";
import { getSession } from "@/modules/session";

export const loader = safeLoader(
  async ({ request, params: { container, id, type } }: LoaderFunctionArgs) => {
    if (!["catalog", "album", "search"].includes(container!)) {
      throw new Error(`Unknown container: ${container}`);
    }

    let session = await getSession(request);

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
